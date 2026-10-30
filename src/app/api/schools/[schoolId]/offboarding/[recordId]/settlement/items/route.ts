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
  params: Promise<{ schoolId: string; recordId: string }>;
};

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const itemTypes = Object.values(StaffOffboardingSettlementItemType);

function parseText(value: unknown, maxLength: number): string | null | undefined {
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

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId, recordId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...roles]);

    const settlement = await prisma.staffOffboardingSettlement.findFirst({
      where: { schoolId, offboardingId: recordId },
      select: {
        id: true,
        status: true,
        currency: true,
        items: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!settlement) {
      return NextResponse.json(
        { error: "Settlement not found for this offboarding record." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      items: settlement.items,
      currency: settlement.currency,
      settlementStatus: settlement.status,
    });
  } catch (error) {
    return authorizationErrorResponse(error) ??
      NextResponse.json(
        { error: "Unable to retrieve settlement items." },
        { status: 500 },
      );
  }
}

export async function POST(request: NextRequest, context: Context) {
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
      "itemType",
      "description",
      "amount",
      "calculationNotes",
      "reference",
    ];

    if (
      Object.keys(data).some((key) => !allowed.includes(key)) ||
      typeof data.itemType !== "string" ||
      !itemTypes.includes(data.itemType as StaffOffboardingSettlementItemType) ||
      typeof data.description !== "string" ||
      !data.description.trim() ||
      data.description.trim().length > 500 ||
      !validAmount(data.amount)
    ) {
      return NextResponse.json(
        {
          error:
            "Provide a valid item type, description, and non-negative amount with up to two decimal places.",
        },
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

    const amount = String(data.amount);
    const description = data.description.trim();
    const itemType = data.itemType as StaffOffboardingSettlementItemType;

    const result = await prisma.$transaction(async (tx) => {
      const settlement = await tx.staffOffboardingSettlement.findFirst({
        where: { schoolId, offboardingId: recordId },
        select: {
          id: true,
          status: true,
          currency: true,
        },
      });

      if (!settlement) {
        return {
          error: "Settlement not found for this offboarding record.",
          status: 404 as const,
        };
      }

      if (settlement.status !== StaffOffboardingSettlementStatus.DRAFT) {
        return {
          error: "Settlement items can only be added while the settlement is in draft.",
          status: 409 as const,
        };
      }

      const item = await tx.staffOffboardingSettlementItem.create({
        data: {
          schoolId,
          settlementId: settlement.id,
          itemType,
          description,
          amount,
          currency: settlement.currency,
          ...(calculationNotes !== undefined ? { calculationNotes } : {}),
          ...(reference !== undefined ? { reference } : {}),
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_OFFBOARDING_SETTLEMENT_ITEM_CREATED",
          resourceType: "StaffOffboardingSettlementItem",
          resourceId: item.id,
          metadata: {
            offboardingId: recordId,
            settlementId: settlement.id,
            itemType: item.itemType,
            description: item.description,
            amount: item.amount.toString(),
            currency: item.currency,
          },
        },
        request,
      );

      return { item };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ item: result.item }, { status: 201 });
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
        { error: "Unable to create settlement item." },
        { status: 500 },
      );
  }
}
