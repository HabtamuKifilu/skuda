import { NextRequest } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";
import { getOnboardingReadiness } from "@/lib/hr/onboarding-readiness";

type Context = {
  params: Promise<{ schoolId: string; onboardingId: string }>;
};

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId, onboardingId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...roles],
    );

    const result = await prisma.$transaction(async (tx) => {
      const readiness = await getOnboardingReadiness(
        tx,
        schoolId,
        onboardingId,
      );

      if (!readiness) {
        return {
          kind: "missing" as const,
        };
      }

      if (readiness.completedAt) {
        return {
          kind: "already-completed" as const,
          completedAt: readiness.completedAt,
        };
      }

      if (!readiness.ready) {
        return {
          kind: "blocked" as const,
          blockers: readiness.blockers,
        };
      }

      const completedAt = new Date();
      const updated = await tx.staffOnboarding.updateMany({
        where: {
          id: onboardingId,
          schoolId,
          completedAt: null,
        },
        data: { completedAt },
      });

      if (updated.count !== 1) {
        return { kind: "conflict" as const };
      }

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_ONBOARDING_COMPLETED",
          resourceType: "StaffOnboarding",
          resourceId: onboardingId,
          metadata: { completedAt: completedAt.toISOString() },
        },
        request,
      );

      return { kind: "completed" as const, completedAt };
    });

    if (result.kind === "missing") {
      return Response.json(
        { error: "Onboarding plan not found in this school." },
        { status: 404 },
      );
    }

    if (result.kind === "already-completed") {
      return Response.json(
        {
          error: "This onboarding plan has already been completed.",
          completedAt: result.completedAt,
        },
        { status: 409 },
      );
    }

    if (result.kind === "blocked") {
      return Response.json(
        {
          error: "Onboarding requirements are not complete.",
          blockers: result.blockers,
        },
        { status: 409 },
      );
    }

    if (result.kind === "conflict") {
      return Response.json(
        { error: "The onboarding plan changed. Refresh and try again." },
        { status: 409 },
      );
    }

    return Response.json({
      completed: true,
      completedAt: result.completedAt,
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to complete onboarding:", error);
    return Response.json(
      { error: "Unable to complete onboarding." },
      { status: 500 },
    );
  }
}
