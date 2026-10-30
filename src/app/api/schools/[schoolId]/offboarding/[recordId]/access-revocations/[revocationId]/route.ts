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
  params: Promise<{
    schoolId: string;
    recordId: string;
    revocationId: string;
  }>;
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

const accessStatuses = Object.values(StaffOffboardingAccessStatus);

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

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, recordId, revocationId } = await context.params;
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
    const allowed = ["status", "outcomeNotes", "externalReference"];

    if (
      Object.keys(data).length === 0 ||
      Object.keys(data).some((key) => !allowed.includes(key)) ||
      typeof data.status !== "string" ||
      !accessStatuses.includes(data.status as StaffOffboardingAccessStatus)
    ) {
      return NextResponse.json(
        { error: "Choose a valid access status and provide supported fields only." },
        { status: 400 },
      );
    }

    const status = data.status as StaffOffboardingAccessStatus;
    const outcomeNotes = parseText(data.outcomeNotes, 3000);
    const externalReference = parseText(data.externalReference, 500);

    if (
      outcomeNotes === undefined ||
      externalReference === undefined
    ) {
      return NextResponse.json(
        { error: "Outcome notes or external reference are invalid." },
        { status: 400 },
      );
    }

    if (
      (
        status === StaffOffboardingAccessStatus.REVOKED ||
        status === StaffOffboardingAccessStatus.NOT_APPLICABLE ||
        status === StaffOffboardingAccessStatus.FAILED
      ) &&
      !outcomeNotes?.trim()
    ) {
      return NextResponse.json(
        { error: "Outcome notes are required for this access status." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const revocation = await tx.staffOffboardingAccessRevocation.findFirst({
        where: {
          id: revocationId,
          schoolId,
          offboardingId: recordId,
        },
        include: {
          offboarding: {
            select: { status: true },
          },
          staffProfile: {
            select: { id: true, userId: true },
          },
        },
      });

      if (!revocation) {
        return {
          error: "Access revocation not found for this offboarding record.",
          status: 404 as const,
        };
      }

      if (closedStatuses.includes(revocation.offboarding.status)) {
        return {
          error: "Access revocations cannot be changed on a closed offboarding record.",
          status: 409 as const,
        };
      }

      if (
        revocation.status === StaffOffboardingAccessStatus.REVOKED &&
        status !== StaffOffboardingAccessStatus.REVOKED
      ) {
        return {
          error: "A verified revocation cannot be downgraded. Create a separately audited correction process if needed.",
          status: 409 as const,
        };
      }

      if (
        revocation.status === StaffOffboardingAccessStatus.NOT_APPLICABLE &&
        status !== StaffOffboardingAccessStatus.NOT_APPLICABLE
      ) {
        return {
          error: "A verified not-applicable outcome cannot be changed through this endpoint.",
          status: 409 as const,
        };
      }

      if (
        revocation.accessType === StaffOffboardingAccessType.SCHOOL_MEMBERSHIP &&
        status === StaffOffboardingAccessStatus.REVOKED
      ) {
        if (
          !revocation.staffProfile.userId ||
          revocation.target !== revocation.staffProfile.userId
        ) {
          return {
            error: "The membership target no longer matches the employee's linked user.",
            status: 409 as const,
          };
        }

        const activeMemberships = await tx.schoolMembership.findMany({
          where: {
            schoolId,
            userId: revocation.staffProfile.userId,
            isActive: true,
          },
          select: { id: true, role: true },
        });

        if (activeMemberships.length > 0) {
          await tx.schoolMembership.updateMany({
            where: {
              schoolId,
              userId: revocation.staffProfile.userId,
              isActive: true,
            },
            data: { isActive: false },
          });

          await createAuditLog(
            tx,
            {
              actorId: authorization.userId,
              schoolId,
              action: "STAFF_OFFBOARDING_SCHOOL_MEMBERSHIPS_DEACTIVATED",
              resourceType: "StaffOffboardingAccessRevocation",
              resourceId: revocation.id,
              metadata: {
                offboardingId: recordId,
                staffProfileId: revocation.staffProfile.id,
                userId: revocation.staffProfile.userId,
                membershipIds: activeMemberships.map((item) => item.id),
                roles: activeMemberships.map((item) => item.role),
              },
            },
            request,
          );
        }

        const stillActive = await tx.schoolMembership.count({
          where: {
            schoolId,
            userId: revocation.staffProfile.userId,
            isActive: true,
          },
        });

        if (stillActive > 0) {
          return {
            error: "One or more school memberships remain active; revocation was not verified.",
            status: 409 as const,
          };
        }
      } else if (
        status === StaffOffboardingAccessStatus.REVOKED &&
        revocation.accessType === StaffOffboardingAccessType.SCHOOL_MEMBERSHIP
      ) {
        return {
          error: "School membership revocation requires a linked employee user.",
          status: 409 as const,
        };
      }

      const now = new Date();
      const updated = await tx.staffOffboardingAccessRevocation.updateMany({
        where: {
          id: revocation.id,
          schoolId,
          offboardingId: recordId,
          status: revocation.status,
          updatedAt: revocation.updatedAt,
        },
        data: {
          status,
          ...(data.outcomeNotes !== undefined ? { outcomeNotes } : {}),
          ...(data.externalReference !== undefined ? { externalReference } : {}),
          ...(status === StaffOffboardingAccessStatus.REVOKED ||
          status === StaffOffboardingAccessStatus.NOT_APPLICABLE
            ? {
                verifiedById: authorization.userId,
                verifiedAt: now,
              }
            : status === StaffOffboardingAccessStatus.FAILED
              ? {
                  verifiedById: authorization.userId,
                  verifiedAt: now,
                }
              : {
                  verifiedById: null,
                  verifiedAt: null,
                }),
        },
      });

      if (updated.count !== 1) {
        return {
          error: "This access request changed concurrently. Refresh and try again.",
          status: 409 as const,
        };
      }

      const updatedRevocation =
        await tx.staffOffboardingAccessRevocation.findFirstOrThrow({
          where: { id: revocation.id, schoolId, offboardingId: recordId },
        });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_OFFBOARDING_ACCESS_REVOCATION_UPDATED",
          resourceType: "StaffOffboardingAccessRevocation",
          resourceId: updatedRevocation.id,
          metadata: {
            offboardingId: recordId,
            staffProfileId: revocation.staffProfile.id,
            accessType: revocation.accessType,
            target: revocation.target,
            previousStatus: revocation.status,
            status: updatedRevocation.status,
            verifiedById: updatedRevocation.verifiedById,
            verifiedAt: updatedRevocation.verifiedAt?.toISOString() ?? null,
            outcomeNotes: updatedRevocation.outcomeNotes,
          },
        },
        request,
      );

      return { revocation: updatedRevocation };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ revocation: result.revocation });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "A concurrent access update conflicted with this request. Refresh and try again." },
        { status: 409 },
      );
    }

    return authorizationErrorResponse(error) ??
      NextResponse.json(
        { error: "Unable to update access revocation." },
        { status: 500 },
      );
  }
}
