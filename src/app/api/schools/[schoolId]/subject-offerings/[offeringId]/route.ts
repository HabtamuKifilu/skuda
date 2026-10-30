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
  params: Promise<{ schoolId: string; offeringId: string }>;
};

const offeringSelect = {
  id: true,
  sectionId: true,
  subjectId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  section: {
    select: {
      id: true,
      name: true,
      code: true,
      academicYear: {
        select: { id: true, name: true, isCurrent: true },
      },
      grade: {
        select: { id: true, name: true, code: true },
      },
      studyShift: {
        select: { id: true, name: true, type: true },
      },
    },
  },
  subject: {
    select: { id: true, name: true, code: true, isActive: true },
  },
  teacherAssignments: {
    where: { status: "ACTIVE" },
    select: {
      id: true,
      startDate: true,
      status: true,
      staffProfile: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          middleName: true,
          lastName: true,
          status: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  },
  _count: {
    select: { assessments: true, timetableEntries: true },
  },
} satisfies Prisma.SubjectOfferingSelect;

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, offeringId } = await context.params;

    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      managementRoles,
    );

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const values = body as Record<string, unknown>;
    const keys = Object.keys(values);
    const isStatusUpdate =
      keys.length === 1 && typeof values.isActive === "boolean";
    const isStructureUpdate =
      keys.length === 2 &&
      keys.includes("sectionId") &&
      keys.includes("subjectId") &&
      typeof values.sectionId === "string" &&
      values.sectionId.trim().length > 0 &&
      typeof values.subjectId === "string" &&
      values.subjectId.trim().length > 0;

    if (!isStatusUpdate && !isStructureUpdate) {
      return Response.json(
        {
          error:
            "Provide either an isActive boolean, or both sectionId and subjectId.",
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.subjectOffering.findFirst({
        where: {
          id: offeringId,
          section: {
            is: { academicYear: { is: { schoolId } } },
          },
        },
        select: {
          id: true,
          isActive: true,
          sectionId: true,
          subjectId: true,
        },
      });

      if (!existing) {
        return {
          error: "Subject offering not found in this school.",
          status: 404,
        } as const;
      }

      if (isStructureUpdate) {
        const sectionId = (values.sectionId as string).trim();
        const subjectId = (values.subjectId as string).trim();

        const [section, subject] = await Promise.all([
          tx.section.findFirst({
            where: {
              id: sectionId,
              isActive: true,
              academicYear: { is: { schoolId } },
            },
            select: { id: true },
          }),
          tx.subject.findFirst({
            where: { id: subjectId, schoolId, isActive: true },
            select: { id: true },
          }),
        ]);

        if (!section) {
          return {
            error: "Select an active section belonging to this school.",
            status: 400,
          } as const;
        }

        if (!subject) {
          return {
            error: "Select an active subject belonging to this school.",
            status: 400,
          } as const;
        }

        const changed =
          existing.sectionId !== sectionId ||
          existing.subjectId !== subjectId;

        if (!changed) {
          return {
            offering: await tx.subjectOffering.findUniqueOrThrow({
              where: { id: existing.id },
              select: offeringSelect,
            }),
          } as const;
        }

        const [assignmentCount, assessmentCount, timetableCount, duplicate] =
          await Promise.all([
            tx.teacherAssignment.count({
              where: { subjectOfferingId: offeringId },
            }),
            tx.assessment.count({
              where: { subjectOfferingId: offeringId },
            }),
            tx.timetableEntry.count({
              where: { subjectOfferingId: offeringId },
            }),
            tx.subjectOffering.findFirst({
              where: {
                id: { not: offeringId },
                sectionId,
                subjectId,
              },
              select: { id: true },
            }),
          ]);

        if (assignmentCount + assessmentCount + timetableCount > 0) {
          return {
            error:
              "This offering has teacher-assignment history, assessments, or timetable entries. Create a new offering instead of changing its section or subject.",
            status: 409,
          } as const;
        }

        if (duplicate) {
          return {
            error: "This subject is already offered in the selected section.",
            status: 409,
          } as const;
        }

        const offering = await tx.subjectOffering.update({
          where: { id: existing.id },
          data: { sectionId, subjectId },
          select: offeringSelect,
        });

        await createAuditLog(
          tx,
          {
            actorId: authorization.userId,
            schoolId,
            action: "SUBJECT_OFFERING_UPDATED",
            resourceType: "SubjectOffering",
            resourceId: offering.id,
            metadata: {
              previousSectionId: existing.sectionId,
              previousSubjectId: existing.subjectId,
              sectionId,
              subjectId,
            },
          },
          request,
        );

        return { offering } as const;
      }

      const isActive = values.isActive as boolean;

      if (!isActive && existing.isActive) {
        const [activeAssignments, activeTimetableEntries] =
          await Promise.all([
            tx.teacherAssignment.count({
              where: {
                subjectOfferingId: offeringId,
                status: "ACTIVE",
              },
            }),
            tx.timetableEntry.count({
              where: {
                subjectOfferingId: offeringId,
                isActive: true,
              },
            }),
          ]);

        if (activeAssignments > 0 || activeTimetableEntries > 0) {
          return {
            error:
              "End active teacher assignments and deactivate timetable entries before deactivating this offering.",
            status: 409,
          } as const;
        }
      }

      const offering = await tx.subjectOffering.update({
        where: { id: existing.id },
        data: { isActive },
        select: offeringSelect,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: isActive
            ? "SUBJECT_OFFERING_ACTIVATED"
            : "SUBJECT_OFFERING_DEACTIVATED",
          resourceType: "SubjectOffering",
          resourceId: offering.id,
          metadata: { isActive },
        },
        request,
      );

      return { offering } as const;
    });

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return Response.json({ offering: result.offering });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to update subject offering:", error);
    return Response.json(
      { error: "Unable to update subject offering." },
      { status: 500 },
    );
  }
}
