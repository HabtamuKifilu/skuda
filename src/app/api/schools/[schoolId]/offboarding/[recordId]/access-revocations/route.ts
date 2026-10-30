import { NextRequest, NextResponse } from "next/server";
import {
  SchoolMembershipRole,
  StaffOffboardingAccessStatus,
  StaffOffboardingAccessType,
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

function parseText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) {
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
        { error: "Offboarding record not found in this school." },
        { status: 404 },
      );
    }

    const revocations = await prisma.staffOffboardingAccessRevocation.findMany({
      where: { schoolId, offboardingId: recordId },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ revocations });
  } catch (error) {
    return authorizationErrorResponse(error) ??
      NextResponse.json({ error: "Unable to load access revocations." }, { status: 500 });
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
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const allowed = ["accessType", "target", "required", "externalReference"];

    if (Object.keys(data).some((key) => !allowed.includes(key))) {
      return NextResponse.json(
        { error: "Request contains unsupported fields." },
        { status: 400 },
      );
    }

    if (
      typeof data.accessType !== "string" ||
      !Object.values(StaffOffboardingAccessType).includes(
        data.accessType as StaffOffboardingAccessType,
      ) ||
      typeof data.target !== "string" ||
      !data.target.trim() ||
      data.target.trim().length > 300 ||
      (data.required !== undefined && typeof data.required !== "boolean")
    ) {
      return NextResponse.json(
        { error: "A valid access type and target are required." },
        { status: 400 },
      );
    }

    const externalReference = parseText(data.externalReference, 500);
    if (externalReference === undefined) {
      return NextResponse.json(
        { error: "External reference is invalid." },
        { status: 400 },
      );
    }

    const accessType = data.accessType as StaffOffboardingAccessType;
    const target = data.target.trim();

    // Membership revocation must target the employee's actual linked user.
    // Other access types are recorded for human verification only.
    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.staffOffboarding.findFirst({
        where: { id: recordId, schoolId },
        include: {
          staffProfile: {
            select: { id: true, userId: true },
          },
        },
      });

      if (!record) {
        return {
          error: "Offboarding record not found in this school.",
          status: 404 as const,
        };
      }

      if (closedStatuses.includes(record.status)) {
        return {
          error: "Access requests cannot be added to a closed offboarding record.",
          status: 409 as const,
        };
      }

      if (
        accessType === StaffOffboardingAccessType.SCHOOL_MEMBERSHIP &&
        (!record.staffProfile.userId ||
          target !== record.staffProfile.userId)
      ) {
        return {
          error: "School membership revocation must target the employee's linked user ID.",
          status: 400 as const,
        };
      }

      const existing = await tx.staffOffboardingAccessRevocation.findFirst({
        where: {
          schoolId,
          offboardingId: record.id,
          accessType,
          target,
          status: {
            in: [
              StaffOffboardingAccessStatus.PENDING,
              StaffOffboardingAccessStatus.IN_PROGRESS,
              StaffOffboardingAccessStatus.FAILED,
            ],
          },
        },
        select: { id: true },
      });

      if (existing) {
        return {
          error: "An open revocation request already exists for this target.",
          status: 409 as const,
        };
      }

      const revocation = await tx.staffOffboardingAccessRevocation.create({
        data: {
          schoolId,
          staffProfileId: record.staffProfile.id,
          offboardingId: record.id,
          accessType,
          target,
          required: data.required === undefined ? true : data.required as boolean,
          externalReference,
          status: StaffOffboardingAccessStatus.PENDING,
          requestedById: authorization.userId,
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_OFFBOARDING_ACCESS_REVOCATION_REQUESTED",
          resourceType: "StaffOffboardingAccessRevocation",
          resourceId: revocation.id,
          metadata: {
            offboardingId: record.id,
            staffProfileId: record.staffProfile.id,
            accessType,
            target,
            required: revocation.required,
            status: revocation.status,
          },
        },
        request,
      );

      return { revocation };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ revocation: result.revocation }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "A concurrent request conflicted with revocation creation. Refresh and try again." },
        { status: 409 },
      );
    }

    return authorizationErrorResponse(error) ??
      NextResponse.json({ error: "Unable to create access revocation request." }, { status: 500 });
  }
}
