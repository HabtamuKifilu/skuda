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
  params: Promise<{ schoolId: string }>;
};

function isDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

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
      isActive: true,
      academicYear: {
        select: {
          id: true,
          name: true,
          isCurrent: true,
        },
      },
      grade: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      studyShift: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  },
  subject: {
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
    },
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
          jobTitle: true,
          status: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  },
  _count: {
    select: {
      assessments: true,
      timetableEntries: true,
      teacherAssignments: true,
    },
  },
} satisfies Prisma.SubjectOfferingSelect;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;

    await requireSchoolRole(
      request.headers,
      schoolId,
      managementRoles,
    );

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        section: {
          is: {
            academicYear: {
              is: { schoolId },
            },
          },
        },
      },
      select: offeringSelect,
      orderBy: [
        { section: { name: "asc" } },
        { subject: { name: "asc" } },
      ],
    });

    return Response.json({ offerings });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load subject offerings:", error);
    return Response.json(
      { error: "Unable to load subject offerings." },
      { status: 500 },
    );
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
    const sectionId =
      typeof data.sectionId === "string" ? data.sectionId.trim() : "";
    const subjectId =
      typeof data.subjectId === "string" ? data.subjectId.trim() : "";

    if (!sectionId || !subjectId) {
      return Response.json(
        { error: "Select both a section and a subject." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const section = await tx.section.findFirst({
        where: {
          id: sectionId,
          isActive: true,
          academicYear: { is: { schoolId } },
        },
        select: { id: true },
      });

      if (!section) {
        return {
          error: "The selected section was not found, is inactive, or does not belong to this school.",
          status: 404,
        } as const;
      }

      const subject = await tx.subject.findFirst({
        where: {
          id: subjectId,
          schoolId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!subject) {
        return {
          error: "The selected subject was not found, is inactive, or does not belong to this school.",
          status: 404,
        } as const;
      }

      const offering = await tx.subjectOffering.create({
        data: {
          sectionId: section.id,
          subjectId: subject.id,
        },
        select: offeringSelect,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SUBJECT_OFFERING_CREATED",
          resourceType: "SubjectOffering",
          resourceId: offering.id,
          metadata: {
            sectionId: offering.sectionId,
            subjectId: offering.subjectId,
          },
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

    return Response.json({ offering: result.offering }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (isDuplicate(error)) {
      return Response.json(
        { error: "This subject is already offered in the selected section." },
        { status: 409 },
      );
    }

    console.error("Failed to create subject offering:", error);
    return Response.json(
      { error: "Unable to create subject offering." },
      { status: 500 },
    );
  }
}
