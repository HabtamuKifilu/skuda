import { NextRequest } from "next/server";
import { StaffDocumentType } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

const allowedRoles = ["OWNER", "ADMIN", "HR_MANAGER"] as const;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;

    await requireSchoolRole(request.headers, schoolId, [...allowedRoles]);

    const staff = await prisma.staffProfile.findMany({
      where: { schoolId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        jobTitle: true,
        department: true,
        status: true,
        employment: {
          select: {
            id: true,
            employmentType: true,
            startDate: true,
            contractStartDate: true,
            contractEndDate: true,
            contractReference: true,
          },
        },
        documents: {
          where: { documentType: StaffDocumentType.EMPLOYMENT_CONTRACT },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            reviewStatus: true,
            issueDate: true,
            expiryDate: true,
            createdAt: true,
          },
        },
      },
    });

    return Response.json({ staff });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Unable to load contracts register:", error);
    return Response.json(
      { error: "Unable to load the contracts register." },
      { status: 500 },
    );
  }
}
