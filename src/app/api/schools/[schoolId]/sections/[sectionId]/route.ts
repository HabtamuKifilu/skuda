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

type RouteContext = {
  params: Promise<{ schoolId: string; sectionId: string }>;
};

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

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, sectionId } = await context.params;
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
    const update: Prisma.SectionUncheckedUpdateInput = {};

    if ("academicYearId" in data) {
      if (
        typeof data.academicYearId !== "string" ||
        !data.academicYearId.trim()
      ) {
        return Response.json(
          { error: "Select a valid academic year." },
          { status: 400 },
        );
      }
      update.academicYearId = data.academicYearId.trim();
    }

    if ("gradeId" in data) {
      if (typeof data.gradeId !== "string" || !data.gradeId.trim()) {
        return Response.json(
          { error: "Select a valid grade." },
          { status: 400 },
        );
      }
      update.gradeId = data.gradeId.trim();
    }

    if ("studyShiftId" in data) {
      if (data.studyShiftId === null || data.studyShiftId === "") {
        update.studyShiftId = null;
      } else if (typeof data.studyShiftId === "string") {
        update.studyShiftId = data.studyShiftId.trim() || null;
      } else {
        return Response.json(
          { error: "Select a valid study shift or leave it unassigned." },
          { status: 400 },
        );
      }
    }

    if ("name" in data) {
      if (
        typeof data.name !== "string" ||
        !data.name.trim() ||
        data.name.trim().length > 100
      ) {
        return Response.json(
          { error: "Section name is required and must not exceed 100 characters." },
          { status: 400 },
        );
      }
      update.name = data.name.trim();
    }

    if ("code" in data) {
      if (
        typeof data.code !== "string" ||
        !data.code.trim() ||
        data.code.trim().length > 30
      ) {
        return Response.json(
          { error: "Section code is required and must not exceed 30 characters." },
          { status: 400 },
        );
      }
      update.code = data.code.trim().toUpperCase();
    }

    if ("capacity" in data) {
      if (data.capacity === null || data.capacity === "") {
        update.capacity = null;
      } else if (
        typeof data.capacity === "number" &&
        Number.isInteger(data.capacity) &&
        data.capacity >= 1
      ) {
        update.capacity = data.capacity;
      } else {
        return Response.json(
          { error: "Capacity must be a positive whole number or left blank." },
          { status: 400 },
        );
      }
    }

    if ("isActive" in data) {
      if (typeof data.isActive !== "boolean") {
        return Response.json(
          { error: "Active status must be true or false." },
          { status: 400 },
        );
      }
      update.isActive = data.isActive;
    }

    if (Object.keys(update).length === 0) {
      return Response.json(
        { error: "Provide at least one field to update." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.section.findFirst({
        where: {
          id: sectionId,
          academicYear: { is: { schoolId } },
        },
        select: {
          id: true,
          academicYearId: true,
          gradeId: true,
          studyShiftId: true,
          isActive: true,
        },
      });

      if (!existing) return { notFound: true as const };

      const nextAcademicYearId =
        typeof update.academicYearId === "string"
          ? update.academicYearId
          : existing.academicYearId;
      const nextGradeId =
        typeof update.gradeId === "string"
          ? update.gradeId
          : existing.gradeId;
      const nextStudyShiftId =
        "studyShiftId" in update
          ? typeof update.studyShiftId === "string"
            ? update.studyShiftId
            : null
          : existing.studyShiftId;
      const activating = update.isActive === true && !existing.isActive;
      const changingGrade = nextGradeId !== existing.gradeId;
      const changingShift = nextStudyShiftId !== existing.studyShiftId;

      const academicYear = await tx.academicYear.findFirst({
        where: { id: nextAcademicYearId, schoolId },
        select: { id: true },
      });

      if (!academicYear) {
        return { error: "Academic year not found in this school.", status: 404 } as const;
      }

      const grade = await tx.grade.findFirst({
        where: { id: nextGradeId, schoolId },
        select: { id: true, isActive: true },
      });

      if (!grade) {
        return { error: "Grade not found in this school.", status: 404 } as const;
      }

      if ((changingGrade || activating) && !grade.isActive) {
        return {
          error: "Activate the grade before assigning or activating this section.",
          status: 409,
        } as const;
      }

      if (nextStudyShiftId) {
        const shift = await tx.studyShift.findFirst({
          where: { id: nextStudyShiftId, schoolId },
          select: { id: true, isActive: true },
        });

        if (!shift) {
          return { error: "Study shift not found in this school.", status: 404 } as const;
        }

        if ((changingShift || activating) && !shift.isActive) {
          return {
            error: "Activate the study shift before assigning or activating this section.",
            status: 409,
          } as const;
        }
      }

      const updated = await tx.section.update({
        where: { id: existing.id },
        data: update,
        select: sectionSelect,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action:
            update.isActive === false
              ? "SECTION_DEACTIVATED"
              : update.isActive === true && !existing.isActive
                ? "SECTION_ACTIVATED"
                : "SECTION_UPDATED",
          resourceType: "Section",
          resourceId: updated.id,
          metadata: update as Prisma.InputJsonObject,
        },
        request,
      );

      return { section: updated } as const;
    });

    if ("notFound" in result) {
      return Response.json(
        { error: "Section not found in this school." },
        { status: 404 },
      );
    }

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return Response.json({ section: result.section });
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

    console.error("Failed to update section:", error);
    return Response.json(
      { error: "Unable to update section." },
      { status: 500 },
    );
  }
}
