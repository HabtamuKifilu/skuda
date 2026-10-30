import { NextRequest, NextResponse } from "next/server";
import {
  SchoolMembershipRole,
  StaffOffboardingSettlementStatus,
  StaffOffboardingStatus,
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

const closedStatuses: StaffOffboardingStatus[] = [
  StaffOffboardingStatus.REJECTED,
  StaffOffboardingStatus.WITHDRAWN,
  StaffOffboardingStatus.COMPLETED,
];

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

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

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId, recordId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...roles]);

    const record = await prisma.staffOffboarding.findFirst({
      where: { id: recordId, schoolId },
      select: { id: true },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Offboarding record not found." },
        { status: 404 },
      );
    }

    const settlement = await prisma.staffOffboardingSettlement.findFirst({
      where: { offboardingId: recordId, schoolId },
      include: {
        items: { orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json({ settlement });
  } catch (error) {
    return authorizationErrorResponse(error) ??
      NextResponse.json(
        { error: "Unable to retrieve final settlement." },
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
    const allowed = ["currency", "periodStart", "periodEnd", "notes"];

    if (
      Object.keys(data).some((key) => !allowed.includes(key))
    ) {
      return NextResponse.json(
        { error: "Unsupported settlement fields supplied." },
        { status: 400 },
      );
    }

    const currency =
      data.currency === undefined ? "ETB" : data.currency;
    const periodStart = parseDate(data.periodStart);
    const periodEnd = parseDate(data.periodEnd);
    const notes = parseText(data.notes, 5000);

    if (
      typeof currency !== "string" ||
      !/^[A-Z]{3}$/.test(currency) ||
      periodStart === undefined ||
      periodEnd === undefined ||
      notes === undefined
    ) {
      return NextResponse.json(
        { error: "Provide a valid three-letter currency, dates, and notes." },
        { status: 400 },
      );
    }

    if (
      periodStart &&
      periodEnd &&
      periodStart.getTime() > periodEnd.getTime()
    ) {
      return NextResponse.json(
        { error: "Settlement period start must not be after its end." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.staffOffboarding.findFirst({
        where: { id: recordId, schoolId },
        select: {
          id: true,
          staffProfileId: true,
          status: true,
        },
      });

      if (!record) {
        return {
          error: "Offboarding record not found.",
          status: 404 as const,
        };
      }

      if (closedStatuses.includes(record.status)) {
        return {
          error: "A settlement cannot be created for a closed offboarding record.",
          status: 409 as const,
        };
      }

      const existing = await tx.staffOffboardingSettlement.findFirst({
        where: { offboardingId: recordId, schoolId },
        include: {
          items: { orderBy: { createdAt: "asc" } },
        },
      });

      if (existing) {
        return {
          error: "A settlement already exists for this offboarding record.",
          status: 409 as const,
        };
      }

      const settlement = await tx.staffOffboardingSettlement.create({
        data: {
          schoolId,
          staffProfileId: record.staffProfileId,
          offboardingId: record.id,
          status: StaffOffboardingSettlementStatus.DRAFT,
          currency,
          ...(periodStart !== undefined ? { periodStart } : {}),
          ...(periodEnd !== undefined ? { periodEnd } : {}),
          ...(notes !== undefined ? { notes } : {}),
          preparedById: authorization.userId,
        },
        include: { items: true },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_OFFBOARDING_SETTLEMENT_CREATED",
          resourceType: "StaffOffboardingSettlement",
          resourceId: settlement.id,
          metadata: {
            offboardingId: record.id,
            staffProfileId: record.staffProfileId,
            currency: settlement.currency,
            periodStart: settlement.periodStart?.toISOString() ?? null,
            periodEnd: settlement.periodEnd?.toISOString() ?? null,
            status: settlement.status,
          },
        },
        request,
      );

      return { settlement };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ settlement: result.settlement }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "P2034" || error.code === "P2002")
    ) {
      return NextResponse.json(
        { error: "A concurrent request may have created this settlement. Refresh and check before retrying." },
        { status: 409 },
      );
    }

    return authorizationErrorResponse(error) ??
      NextResponse.json(
        { error: "Unable to create final settlement." },
        { status: 500 },
      );
  }
}
