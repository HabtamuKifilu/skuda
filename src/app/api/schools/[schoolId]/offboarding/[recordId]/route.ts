import { NextRequest, NextResponse } from "next/server";
import {
  StaffOffboardingStatus,
  StaffStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string; recordId: string }>;
};

const roles = ["OWNER", "ADMIN", "HR_MANAGER"] as const;

function publicRecord<T extends object>(record: T) {
  const safe = { ...record } as T & Record<string, unknown>;

  delete safe.confidentialNotes;
  delete safe.rehireDecisionNotes;
  delete safe.rejectionReason;
  delete safe.feedbackNotes;

  return safe;
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
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
        { error: "A valid request body is required." },
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;
    const action = input.action;

    if (
      ![
        "submit",
        "review",
        "approve",
        "reject",
        "withdraw",
        "complete",
      ].includes(String(action))
    ) {
      return NextResponse.json(
        { error: "Invalid offboarding action." },
        { status: 400 },
      );
    }

    const rejectionReason =
      typeof input.rejectionReason === "string"
        ? input.rejectionReason.trim()
        : "";

    if (
      action === "reject" &&
      (rejectionReason.length < 3 || rejectionReason.length > 1000)
    ) {
      return NextResponse.json(
        { error: "A rejection reason between 3 and 1000 characters is required." },
        { status: 400 },
      );
    }

    const confirmedLastDay = parseDate(input.confirmedLastDay);
    if (
      input.confirmedLastDay !== undefined &&
      confirmedLastDay === undefined
    ) {
      return NextResponse.json(
        { error: "The confirmed last day is invalid." },
        { status: 400 },
      );
    }

    if (
      input.rehireEligible !== undefined &&
      typeof input.rehireEligible !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Rehire eligibility must be a boolean." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const record = await tx.staffOffboarding.findFirst({
          where: { id: recordId, schoolId },
          include: {
            staffProfile: {
              select: {
                id: true,
                employeeNumber: true,
                firstName: true,
                middleName: true,
                lastName: true,
                status: true,
                userId: true,
              },
            },
          },
        });

        if (!record) {
          return {
            error: "Offboarding record not found.",
            status: 404,
          } as const;
        }

        const current = record.status;
        let next: StaffOffboardingStatus;
        const now = new Date();
        const data: Record<string, unknown> = {};

        switch (action) {
          case "submit":
            if (current !== "DRAFT") {
              return {
                error: "Only draft records can be submitted.",
                status: 409,
              } as const;
            }
            next = "SUBMITTED";
            data.submissionDate = now;
            break;

          case "review":
            if (current !== "SUBMITTED") {
              return {
                error: "Only submitted records can enter review.",
                status: 409,
              } as const;
            }
            next = "UNDER_REVIEW";
            break;

          case "approve":
            if (current !== "UNDER_REVIEW") {
              return {
                error: "Only records under review can be approved.",
                status: 409,
              } as const;
            }
            if (
              confirmedLastDay === undefined &&
              !record.confirmedLastDay
            ) {
              return {
                error: "Set a confirmed last day before approving.",
                status: 400,
              } as const;
            }
            if (confirmedLastDay !== undefined) {
              data.confirmedLastDay = confirmedLastDay;
            }
            if (input.rehireEligible !== undefined) {
              data.rehireEligible = input.rehireEligible;
            }
            data.approverId = authorization.userId;
            data.approvedAt = now;
            next = "APPROVED";
            break;

          case "reject":
            if (current !== "UNDER_REVIEW") {
              return {
                error: "Only records under review can be rejected.",
                status: 409,
              } as const;
            }
            data.rejectionReason = rejectionReason;
            data.rejectedAt = now;
            next = "REJECTED";
            break;

          case "withdraw":
            if (
              current !== "DRAFT" &&
              current !== "SUBMITTED" &&
              current !== "UNDER_REVIEW"
            ) {
              return {
                error: "This record can no longer be withdrawn.",
                status: 409,
              } as const;
            }
            next = "WITHDRAWN";
            break;

          case "complete": {
            if (current !== "APPROVED") {
              return {
                error: "Only approved records can be completed.",
                status: 409,
              } as const;
            }

            const lastDay = confirmedLastDay ?? record.confirmedLastDay;

            if (!lastDay) {
              return {
                error: "A confirmed last day is required.",
                status: 400,
              } as const;
            }

            if (lastDay.getTime() > now.getTime()) {
              return {
                error: "Offboarding cannot be completed before the confirmed last day.",
                status: 409,
              } as const;
            }

            if (record.disputePending || record.investigationPending) {
              return {
                error: "Resolve pending disputes and investigations before completing offboarding.",
                status: 409,
              } as const;
            }

            if (record.staffProfile.status === StaffStatus.TERMINATED) {
              return {
                error: "This employee is already terminated.",
                status: 409,
              } as const;
            }

            const requiredTasks = await tx.staffOffboardingTask.findMany({
              where: {
                schoolId,
                offboardingId: record.id,
                required: true,
              },
              select: {
                title: true,
                status: true,
                exceptionReason: true,
              },
            });

            if (requiredTasks.length === 0) {
              return {
                error: "Create the required clearance and handover tasks before completing offboarding.",
                status: 409,
              } as const;
            }

            const unresolvedTasks = requiredTasks.filter(
              (task) =>
                task.status !== "COMPLETED" &&
                !(
                  task.status === "WAIVED" &&
                  Boolean(task.exceptionReason?.trim())
                ),
            );

            if (unresolvedTasks.length > 0) {
              return {
                error: "Resolve or document approved exceptions for all required offboarding tasks before completing offboarding.",
                status: 409,
              } as const;
            }

            const requiredRevocations =
              await tx.staffOffboardingAccessRevocation.findMany({
                where: {
                  schoolId,
                  offboardingId: record.id,
                  required: true,
                },
                select: {
                  accessType: true,
                  status: true,
                  verifiedById: true,
                  verifiedAt: true,
                  outcomeNotes: true,
                },
              });

            const unresolvedRevocations = requiredRevocations.filter(
              (item) =>
                !(
                  (item.status === "REVOKED" ||
                    item.status === "NOT_APPLICABLE") &&
                  item.verifiedById &&
                  item.verifiedAt &&
                  item.outcomeNotes?.trim()
                ),
            );

            if (unresolvedRevocations.length > 0) {
              return {
                error: "Verify the outcome of every required access revocation before completing offboarding.",
                status: 409,
              } as const;
            }

            if (record.staffProfile.userId) {
              const schoolMemberships = await tx.schoolMembership.findMany({
                where: {
                  schoolId,
                  userId: record.staffProfile.userId,
                },
                select: { id: true, isActive: true },
              });

              if (schoolMemberships.length > 0) {
                const membershipRevocation =
                  await tx.staffOffboardingAccessRevocation.findFirst({
                    where: {
                      schoolId,
                      offboardingId: record.id,
                      staffProfileId: record.staffProfileId,
                      accessType: "SCHOOL_MEMBERSHIP",
                      target: record.staffProfile.userId,
                      status: "REVOKED",
                      verifiedById: { not: null },
                      verifiedAt: { not: null },
                    },
                  });

                if (!membershipRevocation) {
                  return {
                    error: "Record and verify the school-membership access revocation before completing offboarding.",
                    status: 409,
                  } as const;
                }

                if (schoolMemberships.some((membership) => membership.isActive)) {
                  return {
                    error: "The employee still has active memberships in this school. Complete and verify access revocation first.",
                    status: 409,
                  } as const;
                }
              }
            }

            const settlement = await tx.staffOffboardingSettlement.findFirst({
              where: {
                schoolId,
                offboardingId: record.id,
                staffProfileId: record.staffProfileId,
              },
              select: {
                status: true,
                paymentDate: true,
                paymentReference: true,
                paymentEvidenceRef: true,
              },
            });

            if (
              !settlement ||
              settlement.status !== "PAID" ||
              !settlement.paymentDate ||
              !settlement.paymentReference?.trim() ||
              !settlement.paymentEvidenceRef?.trim()
            ) {
              return {
                error: "The final settlement must be marked paid with a payment date, reference, and evidence before completing offboarding.",
                status: 409,
              } as const;
            }

            const updatedStaff = await tx.staffProfile.updateMany({
              where: {
                id: record.staffProfileId,
                schoolId,
                status: record.staffProfile.status,
              },
              data: { status: StaffStatus.TERMINATED },
            });

            if (updatedStaff.count !== 1) {
              throw new Error("OFFBOARDING_STAFF_CONCURRENT_CHANGE");
            }

            await createAuditLog(tx, {
              actorId: authorization.userId,
              schoolId,
              action: "SCHOOL_STAFF_STATUS_CHANGED",
              resourceType: "StaffProfile",
              resourceId: record.staffProfileId,
              metadata: {
                employeeNumber: record.staffProfile.employeeNumber,
                previousStatus: record.staffProfile.status,
                newStatus: StaffStatus.TERMINATED,
                reason: "OFFBOARDING_COMPLETED",
                offboardingId: record.id,
                effectiveTerminationDate: lastDay.toISOString(),
              },
            }, request);

            data.confirmedLastDay = lastDay;
            data.effectiveTerminationDate = lastDay;
            next = "COMPLETED";
            break;
          }

          default:
            return {
              error: "Unsupported offboarding action.",
              status: 400,
            } as const;
        }

        data.status = next;

        const updated = await tx.staffOffboarding.update({
          where: { id: record.id },
          data,
          include: {
            staffProfile: {
              select: {
                id: true,
                employeeNumber: true,
                firstName: true,
                middleName: true,
                lastName: true,
                jobTitle: true,
                department: true,
                status: true,
              },
            },
          },
        });

        await createAuditLog(tx, {
          actorId: authorization.userId,
          schoolId,
          action: "SCHOOL_STAFF_OFFBOARDING_" + String(action).toUpperCase(),
          resourceType: "StaffOffboarding",
          resourceId: record.id,
          metadata: {
            previousStatus: current,
            newStatus: next,
            staffProfileId: record.staffProfileId,
          },
        }, request);

        return { record: publicRecord(updated) } as const;
      },
      { isolationLevel: "Serializable" },
    );

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "OFFBOARDING_STAFF_CONCURRENT_CHANGE"
    ) {
      return NextResponse.json(
        { error: "The employee record changed concurrently. Refresh and retry." },
        { status: 409 },
      );
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "The record changed concurrently. Refresh and retry." },
        { status: 409 },
      );
    }

    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to update offboarding record:", error);
    return NextResponse.json(
      { error: "Unable to update the offboarding record." },
      { status: 500 },
    );
  }
}
