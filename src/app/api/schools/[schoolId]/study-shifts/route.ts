import { NextRequest } from "next/server";
import { Prisma, SchoolMembershipRole, StudyShiftType, Weekday } from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.ACADEMIC_HEAD,
];

const validDays = Object.values(Weekday);
const validShiftTypes = Object.values(StudyShiftType);

const shiftTypeDetails = {
  MORNING: { name: "Morning shift", code: "MORNING" },
  AFTERNOON: { name: "Afternoon shift", code: "AFTERNOON" },
  EVENING: { name: "Evening shift", code: "EVENING" },
  WEEKEND: { name: "Weekend shift", code: "WEEKEND" },
} satisfies Record<StudyShiftType, { name: string; code: string }>;

type RouteContext = { params: Promise<{ schoolId: string }> };

function isDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, managementRoles);

    const shifts = await prisma.studyShift.findMany({
      where: { schoolId },
      orderBy: [{ startMinute: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        description: true,
        startMinute: true,
        endMinute: true,
        operatingDays: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { sections: true } },
      },
    });

    return Response.json({ shifts });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    return Response.json(
      { error: "Unable to load study shifts." },
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
    if (
      typeof data.type !== "string" ||
      !validShiftTypes.includes(data.type as StudyShiftType)
    ) {
      return Response.json(
        { error: "Select a valid study shift type." },
        { status: 400 },
      );
    }

    const type = data.type as StudyShiftType;
    const { name, code } = shiftTypeDetails[type];
    const description =
      typeof data.description === "string"
        ? data.description.trim() || null
        : null;
    const startMinute = data.startMinute;
    const endMinute = data.endMinute;
    const operatingDays = data.operatingDays;

    if (description && description.length > 500) {
      return Response.json(
        { error: "Description must be 500 characters or fewer." },
        { status: 400 },
      );
    }

    if (
      typeof startMinute !== "number" ||
      !Number.isInteger(startMinute) ||
      startMinute < 0 ||
      startMinute >= 1440
    ) {
      return Response.json(
        { error: "Start time must be a valid minute of the day." },
        { status: 400 },
      );
    }

    if (
      typeof endMinute !== "number" ||
      !Number.isInteger(endMinute) ||
      endMinute <= startMinute ||
      endMinute > 1440
    ) {
      return Response.json(
        { error: "End time must be after the start time and no later than midnight." },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(operatingDays) ||
      operatingDays.length === 0 ||
      operatingDays.some(
        (day) => typeof day !== "string" || !validDays.includes(day as Weekday),
      ) ||
      new Set(operatingDays).size !== operatingDays.length
    ) {
      return Response.json(
        { error: "Select at least one valid operating day without duplicates." },
        { status: 400 },
      );
    }

    const shift = await prisma.$transaction(async (tx) => {
      const created = await tx.studyShift.create({
        data: {
          schoolId,
          name,
          code,
          type,
          description,
          startMinute,
          endMinute,
          operatingDays: operatingDays as Weekday[],
        },
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          description: true,
          startMinute: true,
          endMinute: true,
          operatingDays: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { sections: true } },
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STUDY_SHIFT_CREATED",
          resourceType: "StudyShift",
          resourceId: created.id,
          metadata: {
            name,
            code,
            type,
            startMinute,
            endMinute,
            operatingDays: operatingDays as string[],
          },
        },
        request,
      );

      return created;
    });

    return Response.json({ shift }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (isDuplicate(error)) {
      return Response.json(
        { error: "This school already has a shift of that type." },
        { status: 409 },
      );
    }

    return Response.json(
      { error: "Unable to create study shift." },
      { status: 500 },
    );
  }
}
