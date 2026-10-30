import { NextRequest } from "next/server";
import {
  Prisma,
  SchoolMembershipRole,
  StaffStatus,
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
  params: Promise<{ schoolId: string; offeringId: string }>;
};

function isDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

const assignmentSelect = {
  id: true,
  staffProfileId: true,
  subjectOfferingId: true,
  startDate: true,
  endDate: true,
  status: true,
  createdAt: true,
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
} satisfies Prisma.TeacherAssignmentSelect;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, offeringId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, managementRoles);

    const offering = await prisma.subjectOffering.findFirst({
      where: {
        id: offeringId,
        section: { is: { academicYear: { is: { schoolId } } } },
      },
      select: { id: true },
    });

    if (!offering) {
      return Response.json(
        { error: "Subject offering not found in this school." },
        { status: 404 },
      );
    }

    const assignments = await prisma.teacherAssignment.findMany({
      where: { subjectOfferingId: offeringId },
      select: assignmentSelect,
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    });

    return Response.json({ assignments });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load teacher assignments:", error);
    return Response.json(
      { error: "Unable to load teacher assignments." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, offeringId } = await context.params;
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
    const allowedFields = ["staffProfileId", "startDate"];

    if (
      Object.keys(data).some((key) => !allowedFields.includes(key)) ||
      typeof data.staffProfileId !== "string" ||
      !data.staffProfileId.trim()
    ) {
      return Response.json(
        { error: "Provide a staffProfileId and an optional startDate." },
        { status: 400 },
      );
    }

    let startDate = new Date();

    if (Object.prototype.hasOwnProperty.call(data, "startDate")) {
      if (
        typeof data.startDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)
      ) {
        return Response.json(
          { error: "startDate must use YYYY-MM-DD format." },
          { status: 400 },
        );
      }

      startDate = new Date(data.startDate + "T00:00:00.000Z");

      if (
        Number.isNaN(startDate.getTime()) ||
        startDate.toISOString().slice(0, 10) !== data.startDate
      ) {
        return Response.json(
          { error: "Enter a valid start date." },
          { status: 400 },
        );
      }
    }

    const staffProfileId = data.staffProfileId.trim();

    const result = await prisma.$transaction(async (tx) => {
      const offering = await tx.subjectOffering.findFirst({
        where: {
          id: offeringId,
          isActive: true,
          section: {
            is: {
              isActive: true,
              academicYear: { is: { schoolId } },
            },
          },
          subject: { is: { isActive: true, schoolId } },
        },
        select: { id: true },
      });

      if (!offering) {
        return {
          error: "An active subject offering in this school is required.",
          status: 404,
        } as const;
      }

      const staff = await tx.staffProfile.findFirst({
        where: {
          id: staffProfileId,
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
        select: { id: true },
      });

      if (!staff) {
        return {
          error: "Select an active staff member with an active teacher membership in this school.",
          status: 422,
        } as const;
      }

      const existing = await tx.teacherAssignment.findFirst({
        where: {
          subjectOfferingId: offeringId,
          status: TeacherAssignmentStatus.ACTIVE,
        },
        select: { id: true },
      });

      if (existing) {
        return {
          error: "This offering already has an active teacher. End the current assignment before assigning another teacher.",
          status: 409,
        } as const;
      }

      const assignment = await tx.teacherAssignment.create({
        data: {
          staffProfileId: staff.id,
          subjectOfferingId: offering.id,
          startDate,
          status: TeacherAssignmentStatus.ACTIVE,
        },
        select: assignmentSelect,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "TEACHER_ASSIGNED_TO_SUBJECT_OFFERING",
          resourceType: "TeacherAssignment",
          resourceId: assignment.id,
          metadata: {
            staffProfileId: assignment.staffProfileId,
            subjectOfferingId: assignment.subjectOfferingId,
            startDate: assignment.startDate.toISOString(),
          },
        },
        request,
      );

      return { assignment } as const;
    });

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return Response.json({ assignment: result.assignment }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (isDuplicate(error)) {
      return Response.json(
        { error: "This assignment conflicts with an existing record." },
        { status: 409 },
      );
    }

    console.error("Failed to assign teacher:", error);
    return Response.json(
      { error: "Unable to assign teacher." },
      { status: 500 },
    );
  }
}
