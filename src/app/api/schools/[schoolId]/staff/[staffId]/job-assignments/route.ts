import { NextRequest } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string; staffId: string }>;
};

const allowedRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const assignmentInclude = {
  jobTitle: {
    select: { id: true, name: true },
  },
  department: {
    select: { id: true, name: true },
  },
  reportingManager: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
  },
  approvedBy: {
    select: { id: true, name: true, email: true },
  },
} as const;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, staffId } = await context.params;

    await requireSchoolRole(request.headers, schoolId, [...allowedRoles]);

    const employee = await prisma.staffProfile.findFirst({
      where: { id: staffId, schoolId },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        status: true,
        jobTitle: true,
        department: true,
      },
    });

    if (!employee) {
      return Response.json(
        { error: "Employee not found in this school." },
        { status: 404 },
      );
    }

    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const [currentAssignment, history] = await Promise.all([
      prisma.staffJobAssignment.findFirst({
        where: {
          schoolId,
          staffProfileId: staffId,
          effectiveDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
        include: assignmentInclude,
      }),
      prisma.staffJobAssignment.findMany({
        where: { schoolId, staffProfileId: staffId },
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
        include: assignmentInclude,
      }),
    ]);

    return Response.json({
      employee,
      currentAssignment,
      history,
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load staff job assignment history:", error);
    return Response.json(
      { error: "Unable to load job assignment history." },
      { status: 500 },
    );
  }
}
