import { NextRequest } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string; staffId: string }>;
};

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, staffId } = await context.params;

    await requireSchoolRole(request.headers, schoolId, [...managementRoles]);

    const staff = await prisma.staffProfile.findFirst({
      where: { id: staffId, schoolId },
      select: { id: true },
    });

    if (!staff) {
      return Response.json(
        { error: "Employee not found in this school." },
        { status: 404 },
      );
    }

    const history = await prisma.staffEmploymentHistory.findMany({
      where: { schoolId, staffProfileId: staff.id },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        changeType: true,
        effectiveDate: true,
        previousJobTitle: true,
        newJobTitle: true,
        previousDepartment: true,
        newDepartment: true,
        description: true,
        notes: true,
        createdAt: true,
      },
    });

    return Response.json({ history });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load staff employment history:", error);
    return Response.json(
      { error: "Unable to load employment history." },
      { status: 500 },
    );
  }
}
