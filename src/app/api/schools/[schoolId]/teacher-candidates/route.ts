import { NextRequest } from "next/server";
import { SchoolMembershipRole, StaffStatus } from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.ACADEMIC_HEAD,
];

type RouteContext = { params: Promise<{ schoolId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, managementRoles);

    const candidates = await prisma.staffProfile.findMany({
      where: {
        schoolId,
        status: StaffStatus.ACTIVE,
        userId: { not: null },
        user: {
          is: {
            memberships: {
              some: {
                schoolId,
                role: SchoolMembershipRole.TEACHER,
                isActive: true,
              },
            },
          },
        },
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        jobTitle: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return Response.json({ candidates });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load eligible teacher candidates:", error);
    return Response.json(
      { error: "Unable to load eligible teachers." },
      { status: 500 },
    );
  }
}
