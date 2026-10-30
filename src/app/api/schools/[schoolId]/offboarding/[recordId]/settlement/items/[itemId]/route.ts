import { NextRequest, NextResponse } from "next/server";
import {
  SchoolMembershipRole,
  StaffOffboardingSettlementStatus,
  StaffOffboardingSettlementItemType,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{
    schoolId: string;
    recordId: string;
    itemId: string;
  }>;
};

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const itemTypes = Object.values(StaffOffboardingSettlementItemType);

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

function validAmount(value: unknown): value is string | number {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const text = String(value);
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(text)) return false;
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0;
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, recordId, itemId } = await context.params;
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
      "itemType",
      "description",
      "amount",
      "calculationNotes",
      "reference",
    ];

    if (
      Object.keys(data).length === 0 ||
      Object.keys(data).some((key) => !allowed.includes(key))
    ) {
      return NextResponse.json(
        { error: "Provide supported settlement-item fields only." },
        { status: 400 },
      );
    }

    if (
      data.itemType !== undefined &&
      (typeof data.itemType !== "string" ||
        !itemTypes.includes(
          data.itemType as StaffOffboardingSettlementItemType,
        ))
    ) {
      return NextResponse.json(
        { error: "Invalid settlement item type." },
        { status: 400 },
      );
    }

    if (
      data.description !== undefined &&
      (typeof data.description !== "string" ||
        !data.description.trim() ||
        data.description.trim().length > 500)
    ) {
      return NextResponse.json(
        { error: "Description must contain 1–500 characters." },
        { status: 400 },
      );
    }

    if (data.amount !== undefined && !validAmount(data.amount)) {
      return NextResponse.json(
        { error: "Amount must be non-negative with up to two decimal places." },
        { status: 400 },
      );
    }

    const calculationNotes = parseText(data.calculationNotes, 3000);
    const reference = parseText(data.reference, 500);

    if (calculationNotes === undefined || reference === undefined) {
      return NextResponse.json(
        { error: "Calculation notes or reference are invalid." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.staffOffboardingSettlementItem.findFirst({
        where: {
          id: itemId,
          schoolId,
          settlement: {
            schoolId,
            offboardingId: recordId,
          },
        },
        include: {
          settlement: {
            select: { id: true, status: true, currency: true },
          },
        },
      });

      if (!item) {
        return {
          error: "Settlement item not found for this offboarding record.",
          status: 404 as const,
        };
      }

      if (item.settlement.status !== StaffOffboardingSettlementStatus.DRAFT) {
        return {
          error: "Settlement items can only be edited while the settlement is in draft.",
          status: 409 as const,
        };
      }

      const updated = await tx.staffOffboardingSettlementItem.updateMany({
        where: {
          id: item.id,
          schoolId,
          settlementId: item.settlementId,
        },
        data: {
          ...(data.itemType !== undefined
            ? {
                itemType:
                  data.itemType as StaffOffboardingSettlementItemType,
              }
            : {}),
          ...(data.description !== undefined
            ? { description: (data.description as string).trim() }
            : {}),
          ...(data.amount !== undefined
            ? { amount: String(data.amount) }
            : {}),
          ...(data.calculationNotes !== undefined
            ? { calculationNotes }
            : {}),
          ...(data.reference !== undefined ? { reference } : {}),
        },
      });

      if (updated.count !== 1) {
        return {
          error: "The settlement item changed unexpectedly. Refresh and retry.",
          status: 409 as const,
        };
      }

      const updatedItem =
        await tx.staffOffboardingSettlementItem.findFirstOrThrow({
          where: { id: item.id, schoolId, settlementId: item.settlementId },
        });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_OFFBOARDING_SETTLEMENT_ITEM_UPDATED",
          resourceType: "StaffOffboardingSettlementItem",
          resourceId: item.id,
          metadata: {
            offboardingId: recordId,
            settlementId: item.settlementId,
            previous: {
              itemType: item.itemType,
              description: item.description,
              amount: item.amount.toString(),
              calculationNotes: item.calculationNotes,
              reference: item.reference,
            },
            updated: {
              itemType: updatedItem.itemType,
              description: updatedItem.description,
              amount: updatedItem.amount.toString(),
              calculationNotes: updatedItem.calculationNotes,
              reference: updatedItem.reference,
            },
          },
        },
        request,
      );

      return { item: updatedItem };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ item: result.item });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "A concurrent update conflicted with this request. Refresh and retry." },
        { status: 409 },
      );
    }

    return authorizationErrorResponse(error) ??
      NextResponse.json(
        { error: "Unable to update settlement item." },
        { status: 500 },
      );
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { schoolId, recordId, itemId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...roles],
    );

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.staffOffboardingSettlementItem.findFirst({
        where: {
          id: itemId,
          schoolId,
          settlement: {
            schoolId,
            offboardingId: recordId,
          },
        },
        include: {
          settlement: {
            select: { id: true, status: true },
          },
        },
      });

      if (!item) {
        return {
          error: "Settlement item not found for this offboarding record.",
          status: 404 as const,
        };
      }

      if (item.settlement.status !== StaffOffboardingSettlementStatus.DRAFT) {
        return {
          error: "Settlement items can only be deleted while the settlement is in draft.",
          status: 409 as const,
        };
      }

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_OFFBOARDING_SETTLEMENT_ITEM_DELETED",
          resourceType: "StaffOffboardingSettlementItem",
          resourceId: item.id,
          metadata: {
            offboardingId: recordId,
            settlementId: item.settlementId,
            itemType: item.itemType,
            description: item.description,
            amount: item.amount.toString(),
            currency: item.currency,
            calculationNotes: item.calculationNotes,
            reference: item.reference,
          },
        },
        request,
      );

      const deleted = await tx.staffOffboardingSettlementItem.deleteMany({
        where: {
          id: item.id,
          schoolId,
          settlementId: item.settlementId,
        },
      });

      if (deleted.count !== 1) {
        return {
          error: "The settlement item changed unexpectedly. Refresh and retry.",
          status: 409 as const,
        };
      }

      return { deleted: true };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "A concurrent update conflicted with this request. Refresh and retry." },
        { status: 409 },
      );
    }

    return authorizationErrorResponse(error) ??
      NextResponse.json(
        { error: "Unable to delete settlement item." },
        { status: 500 },
      );
  }
}
