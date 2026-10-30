import { NextRequest } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
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

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId, onboardingId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...roles]);

    const readiness = await prisma.$transaction((tx) =>
      getOnboardingReadiness(tx, schoolId, onboardingId),
    );

    if (!readiness) {
      return Response.json(
        { error: "Onboarding plan not found in this school." },
        { status: 404 },
      );
    }

    return Response.json({ readiness });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to check onboarding readiness:", error);
    return Response.json(
      { error: "Unable to check onboarding readiness." },
      { status: 500 },
    );
  }
}
