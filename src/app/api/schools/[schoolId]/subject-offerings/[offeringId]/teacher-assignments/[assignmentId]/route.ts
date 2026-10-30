import { NextRequest } from "next/server";
import {
  SchoolMembershipRole,
  TeacherAssignmentStatus,
} from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.ACADEMIC_HEAD,
];

type RouteContext = {
  params: Promise<{
    schoolId: string;
    offeringId: string;
    assignmentId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, offeringId, assignmentId } = await context.params;

    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      managementRoles,
    );

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "A valid request body is required." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    if (
      Object.keys(data).length !== 1 ||
      typeof data.endDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.endDate)
    ) {
      return Response.json(
        { error: "Provide endDate in YYYY-MM-DD format." },
        { status: 400 },
      );
    }

    const endDate = new Date(data.endDate + "T00:00:00.000Z");

    if (
      Number.isNaN(endDate.getTime()) ||
      endDate.toISOString().slice(0, 10) !== data.endDate
    ) {
      return Response.json(
        { error: "Enter a valid end date." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.teacherAssignment.findFirst({
        where: {
          id: assignmentId,
          subjectOfferingId: offeringId,
          subjectOffering: {
            is: {
              section: {
                is: {
                  academicYear: { is: { schoolId } },
                },
              },
            },
          },
        },
        select: {
          id: true,
          staffProfileId: true,
          subjectOfferingId: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      });

      if (!assignment) {
        return {
          error: "Teacher assignment not found in this school offering.",
          status: 404,
        } as const;
      }

      if (assignment.status !== TeacherAssignmentStatus.ACTIVE) {
        return {
          error: "This teacher assignment has already ended.",
          status: 409,
        } as const;
      }

      if (endDate < assignment.startDate) {
        return {
          error: "The end date cannot be earlier than the assignment start date.",
          status: 422,
        } as const;
      }

      const activeTimetableEntries = await tx.timetableEntry.count({
        where: {
          teacherAssignmentId: assignment.id,
          isActive: true,
        },
      });

      if (activeTimetableEntries > 0) {
        return {
          error:
            "Deactivate or reassign this teacher's active timetable entries before ending the assignment.",
          status: 409,
        } as const;
      }

      const updated = await tx.teacherAssignment.update({
        where: { id: assignment.id },
        data: {
          endDate,
          status: TeacherAssignmentStatus.ENDED,
        },
        select: {
          id: true,
          staffProfileId: true,
          subjectOfferingId: true,
          startDate: true,
          endDate: true,
          status: true,
          updatedAt: true,
          staffProfile: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
              email: true,
              jobTitle: true,
              department: true,
              status: true,
            },
          },
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "TEACHER_ASSIGNMENT_ENDED",
          resourceType: "TeacherAssignment",
          resourceId: updated.id,
          metadata: {
            staffProfileId: updated.staffProfileId,
            subjectOfferingId: updated.subjectOfferingId,
            endDate: updated.endDate?.toISOString() ?? null,
          },
        },
        request,
      );

      return { assignment: updated } as const;
    });

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return Response.json({ assignment: result.assignment });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to end teacher assignment:", error);
    return Response.json(
      { error: "Unable to end teacher assignment." },
      { status: 500 },
    );
  }
}
