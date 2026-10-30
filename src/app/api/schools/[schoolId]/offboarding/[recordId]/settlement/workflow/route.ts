import { NextRequest, NextResponse } from "next/server";
import {
  SchoolMembershipRole,
  StaffOffboardingSettlementStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ schoolId: string; recordId: string }>;
};

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

function parseText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    return undefined;
  }
  return value.trim() || null;
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, recordId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...roles],
    );

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    const allowed = [
      "action",
      "paymentDate",
      "paymentReference",
      "paymentEvidenceRef",
      "acknowledgmentRef",
      "notes",
    ];

    if (
      Object.keys(data).some((key) => !allowed.includes(key)) ||
      typeof data.action !== "string"
    ) {
      return NextResponse.json(
        { error: "Provide a supported settlement workflow action." },
        { status: 400 },
      );
    }

    const actions = [
      "submit_for_review",
      "approve",
      "request_payment",
      "mark_paid",
      "mark_disputed",
      "cancel",
      "acknowledge",
    ] as const;

    if (!(actions as readonly string[]).includes(data.action)) {
      return NextResponse.json(
        { error: "Unsupported settlement workflow action." },
        { status: 400 },
      );
    }

    const paymentDate = parseDate(data.paymentDate);
    const paymentReference = parseText(data.paymentReference, 500);
    const paymentEvidenceRef = parseText(data.paymentEvidenceRef, 1000);
    const acknowledgmentRef = parseText(data.acknowledgmentRef, 1000);
    const notes = parseText(data.notes, 5000);

    if (
      paymentDate === undefined ||
      paymentReference === undefined ||
      paymentEvidenceRef === undefined ||
      acknowledgmentRef === undefined ||
      notes === undefined
    ) {
      return NextResponse.json(
        { error: "One or more settlement workflow fields are invalid." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const settlement = await tx.staffOffboardingSettlement.findFirst({
        where: { schoolId, offboardingId: recordId },
        include: {
          items: true,
          offboarding: {
            select: {
              id: true,
              status: true,
              staffProfileId: true,
            },
          },
        },
      });

      if (!settlement) {
        return {
          error: "Settlement not found for this offboarding record.",
          status: 404 as const,
        };
      }

      const now = new Date();
      const action = data.action as (typeof actions)[number];
      const current = settlement.status;
      const update: Record<string, unknown> = {};
      let next: StaffOffboardingSettlementStatus = current;

      switch (action) {
        case "submit_for_review": {
          if (current !== StaffOffboardingSettlementStatus.DRAFT) {
            return {
              error: "Only a draft settlement can be submitted for review.",
              status: 409 as const,
            };
          }
          if (settlement.items.length === 0) {
            return {
              error: "Add at least one settlement item before submitting.",
              status: 409 as const,
            };
          }
          next = StaffOffboardingSettlementStatus.IN_REVIEW;
          break;
        }

        case "approve": {
          if (current !== StaffOffboardingSettlementStatus.IN_REVIEW) {
            return {
              error: "Only a settlement in review can be approved.",
              status: 409 as const,
            };
          }
          if (settlement.preparedById === authorization.userId) {
            return {
              error: "The preparer cannot approve their own settlement.",
              status: 403 as const,
            };
          }
          update.reviewedById = authorization.userId;
          update.reviewedAt = now;
          update.approvedById = authorization.userId;
          update.approvedAt = now;
          next = StaffOffboardingSettlementStatus.APPROVED;
          break;
        }

        case "request_payment": {
          if (current !== StaffOffboardingSettlementStatus.APPROVED) {
            return {
              error: "Only an approved settlement can be marked payment pending.",
              status: 409 as const,
            };
          }
          next = StaffOffboardingSettlementStatus.PAYMENT_PENDING;
          break;
        }

        case "mark_paid": {
          if (current !== StaffOffboardingSettlementStatus.PAYMENT_PENDING) {
            return {
              error: "Only a payment-pending settlement can be marked paid.",
              status: 409 as const,
            };
          }
          if (
            !paymentDate ||
            !paymentReference?.trim() ||
            !paymentEvidenceRef?.trim()
          ) {
            return {
              error: "Payment date, payment reference, and payment evidence are required.",
              status: 400 as const,
            };
          }
          update.paymentDate = paymentDate;
          update.paymentReference = paymentReference;
          update.paymentEvidenceRef = paymentEvidenceRef;
          next = StaffOffboardingSettlementStatus.PAID;
          break;
        }

        case "mark_disputed": {
          if (
            current === StaffOffboardingSettlementStatus.PAID ||
            current === StaffOffboardingSettlementStatus.CANCELLED ||
            current === StaffOffboardingSettlementStatus.DISPUTED
          ) {
            return {
              error: "This settlement cannot be moved to disputed from its current status.",
              status: 409 as const,
            };
          }
          if (!notes?.trim()) {
            return {
              error: "A reason is required to dispute a settlement.",
              status: 400 as const,
            };
          }
          update.notes = notes;
          next = StaffOffboardingSettlementStatus.DISPUTED;
          break;
        }

        case "cancel": {
          if (
            current === StaffOffboardingSettlementStatus.PAID ||
            current === StaffOffboardingSettlementStatus.CANCELLED
          ) {
            return {
              error: "A paid or already cancelled settlement cannot be cancelled.",
              status: 409 as const,
            };
          }
          if (!notes?.trim()) {
            return {
              error: "A reason is required to cancel a settlement.",
              status: 400 as const,
            };
          }
          update.notes = notes;
          next = StaffOffboardingSettlementStatus.CANCELLED;
          break;
        }

        case "acknowledge": {
          if (current !== StaffOffboardingSettlementStatus.PAID) {
            return {
              error: "Only a paid settlement can have its employee acknowledgment recorded.",
              status: 409 as const,
            };
          }
          if (!acknowledgmentRef?.trim()) {
            return {
              error: "An acknowledgment reference is required.",
              status: 400 as const,
            };
          }
          if (settlement.employeeAcknowledged) {
            return {
              error: "Employee acknowledgment has already been recorded.",
              status: 409 as const,
            };
          }
          update.employeeAcknowledged = true;
          update.acknowledgedAt = now;
          update.acknowledgmentRef = acknowledgmentRef;
          break;
        }
      }

      if (action !== "acknowledge") {
        update.status = next;
      }

      const updated = await tx.staffOffboardingSettlement.updateMany({
        where: {
          id: settlement.id,
          schoolId,
          offboardingId: recordId,
          status: current,
          updatedAt: settlement.updatedAt,
        },
        data: update,
      });

      if (updated.count !== 1) {
        return {
          error: "The settlement changed concurrently. Refresh and retry.",
          status: 409 as const,
        };
      }

      const updatedSettlement =
        await tx.staffOffboardingSettlement.findFirstOrThrow({
          where: { id: settlement.id, schoolId, offboardingId: recordId },
          include: { items: true },
        });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: `STAFF_OFFBOARDING_SETTLEMENT_${action.toUpperCase()}`,
          resourceType: "StaffOffboardingSettlement",
          resourceId: settlement.id,
          metadata: {
            offboardingId: recordId,
            previousStatus: current,
            status: updatedSettlement.status,
            action,
            paymentDate: updatedSettlement.paymentDate?.toISOString() ?? null,
            paymentReference: updatedSettlement.paymentReference,
            employeeAcknowledged: updatedSettlement.employeeAcknowledged,
            acknowledgmentRef: updatedSettlement.acknowledgmentRef,
            notes: action === "mark_disputed" || action === "cancel" ? notes : undefined,
          },
        },
        request,
      );

      return { settlement: updatedSettlement };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ settlement: result.settlement });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "A concurrent settlement update conflicted with this request. Refresh and retry." },
        { status: 409 },
      );
    }

    return authorizationErrorResponse(error) ??
      NextResponse.json(
        { error: "Unable to process settlement workflow action." },
        { status: 500 },
      );
  }
}
