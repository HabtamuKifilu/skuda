import { NextRequest } from "next/server";
import { Prisma, SchoolMembershipRole } from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.ACADEMIC_HEAD,
];

type RouteContext = { params: Promise<{ schoolId: string }> };

function isDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

const sectionSelect = {
  id: true,
  academicYearId: true,
  gradeId: true,
  studyShiftId: true,
  name: true,
  code: true,
  capacity: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  academicYear: {
    select: { id: true, name: true, isCurrent: true },
  },
  grade: {
    select: { id: true, name: true, code: true, level: true, isActive: true },
  },
  studyShift: {
    select: {
      id: true,
      name: true,
      type: true,
      startMinute: true,
      endMinute: true,
      isActive: true,
    },
  },
  _count: {
    select: {
      enrollments: true,
      subjectOfferings: true,
      timetableEntries: true,
    },
  },
} satisfies Prisma.SectionSelect;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, managementRoles);

    const sections = await prisma.section.findMany({
      where: { academicYear: { is: { schoolId } } },
      orderBy: [{ name: "asc" }],
      select: sectionSelect,
    });

    return Response.json({ sections });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to list sections:", error);
    return Response.json({ error: "Unable to load sections." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
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
    const academicYearId =
      typeof data.academicYearId === "string" ? data.academicYearId.trim() : "";
    const gradeId =
      typeof data.gradeId === "string" ? data.gradeId.trim() : "";
    const studyShiftId =
      data.studyShiftId === null || data.studyShiftId === ""
        ? null
        : typeof data.studyShiftId === "string"
          ? data.studyShiftId.trim() || null
          : undefined;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const code =
      typeof data.code === "string" ? data.code.trim().toUpperCase() : "";
    const capacity = data.capacity === "" || data.capacity === null
      ? null
      : data.capacity;

    if (!academicYearId || !gradeId) {
      return Response.json(
        { error: "Select an academic year and grade." },
        { status: 400 },
      );
    }

    if (studyShiftId === undefined) {
      return Response.json(
        { error: "Select a valid study shift or leave it unassigned." },
        { status: 400 },
      );
    }

    if (!name || name.length > 100) {
      return Response.json(
        { error: "Section name is required and must not exceed 100 characters." },
        { status: 400 },
      );
    }

    if (!code || code.length > 30) {
      return Response.json(
        { error: "Section code is required and must not exceed 30 characters." },
        { status: 400 },
      );
    }

    if (
      capacity !== null &&
      (typeof capacity !== "number" ||
        !Number.isInteger(capacity) ||
        capacity < 1)
    ) {
      return Response.json(
        { error: "Capacity must be a positive whole number or left blank." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const academicYear = await tx.academicYear.findFirst({
        where: { id: academicYearId, schoolId },
        select: { id: true },
      });

      if (!academicYear) {
        return {
          error: "Academic year not found in this school.",
          status: 404,
        } as const;
      }

      const grade = await tx.grade.findFirst({
        where: { id: gradeId, schoolId },
        select: { id: true, isActive: true },
      });

      if (!grade) {
        return {
          error: "Grade not found in this school.",
          status: 404,
        } as const;
      }

      if (!grade.isActive) {
        return {
          error: "Activate this grade before creating a section for it.",
          status: 409,
        } as const;
      }

      if (studyShiftId) {
        const shift = await tx.studyShift.findFirst({
          where: { id: studyShiftId, schoolId },
          select: { id: true, isActive: true },
        });

        if (!shift) {
          return {
            error: "Study shift not found in this school.",
            status: 404,
          } as const;
        }

        if (!shift.isActive) {
          return {
            error: "Only active study shifts can be assigned to a new section.",
            status: 409,
          } as const;
        }
      }

      const section = await tx.section.create({
        data: {
          academicYearId,
          gradeId,
          studyShiftId,
          name,
          code,
          capacity,
        },
        select: sectionSelect,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SECTION_CREATED",
          resourceType: "Section",
          resourceId: section.id,
          metadata: {
            name,
            code,
            academicYearId,
            gradeId,
            studyShiftId,
            capacity,
          },
        },
        request,
      );

      return { section } as const;
    });

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return Response.json({ section: result.section }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (isDuplicate(error)) {
      return Response.json(
        {
          error:
            "A section with this name or code already exists in the academic year.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to create section:", error);
    return Response.json({ error: "Unable to create section." }, { status: 500 });
  }
}
