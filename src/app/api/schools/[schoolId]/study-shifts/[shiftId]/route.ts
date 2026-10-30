import { NextRequest } from "next/server";
import { Prisma, SchoolMembershipRole, Weekday } from "@/generated/prisma/client";
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

type RouteContext = {
  params: Promise<{ schoolId: string; shiftId: string }>;
};

function isDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, shiftId } = await context.params;
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

    if ("name" in data || "code" in data || "type" in data) {
      return Response.json(
        { error: "Shift type, name, and code are managed by the system." },
        { status: 400 },
      );
    }

    const update: Prisma.StudyShiftUpdateInput = {};

    if ("description" in data) {
      if (data.description !== null && typeof data.description !== "string") {
        return Response.json(
          { error: "Description must be text." },
          { status: 400 },
        );
      }
      const description =
        typeof data.description === "string" ? data.description.trim() : "";
      if (description.length > 500) {
        return Response.json(
          { error: "Description must be 500 characters or fewer." },
          { status: 400 },
        );
      }
      update.description = description || null;
    }

    if ("startMinute" in data) {
      if (
        typeof data.startMinute !== "number" ||
        !Number.isInteger(data.startMinute) ||
        data.startMinute < 0 ||
        data.startMinute >= 1440
      ) {
        return Response.json(
          { error: "Start time must be a valid minute of the day." },
          { status: 400 },
        );
      }
      update.startMinute = data.startMinute;
    }

    if ("endMinute" in data) {
      if (
        typeof data.endMinute !== "number" ||
        !Number.isInteger(data.endMinute) ||
        data.endMinute < 1 ||
        data.endMinute > 1440
      ) {
        return Response.json(
          { error: "End time must be no later than midnight." },
          { status: 400 },
        );
      }
      update.endMinute = data.endMinute;
    }

    if ("operatingDays" in data) {
      if (
        !Array.isArray(data.operatingDays) ||
        data.operatingDays.length === 0 ||
        data.operatingDays.some(
          (day) => typeof day !== "string" || !validDays.includes(day as Weekday),
        ) ||
        new Set(data.operatingDays).size !== data.operatingDays.length
      ) {
        return Response.json(
          { error: "Select at least one valid operating day without duplicates." },
          { status: 400 },
        );
      }
      update.operatingDays = data.operatingDays as Weekday[];
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
      const existing = await tx.studyShift.findFirst({
        where: { id: shiftId, schoolId },
        select: {
          id: true,
          startMinute: true,
          endMinute: true,
          isActive: true,
        },
      });

      if (!existing) return null;

      const nextStart = update.startMinute ?? existing.startMinute;
      const nextEnd = update.endMinute ?? existing.endMinute;

      if (nextEnd <= nextStart) {
        return { invalidTime: true as const };
      }

      const updated = await tx.studyShift.update({
        where: { id: existing.id },
        data: update,
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
          action:
            update.isActive === false
              ? "STUDY_SHIFT_DEACTIVATED"
              : update.isActive === true && !existing.isActive
                ? "STUDY_SHIFT_ACTIVATED"
                : "STUDY_SHIFT_UPDATED",
          resourceType: "StudyShift",
          resourceId: updated.id,
          metadata: update as Prisma.InputJsonObject,
        },
        request,
      );

      return { shift: updated };
    });

    if (!result) {
      return Response.json(
        { error: "Study shift not found in this school." },
        { status: 404 },
      );
    }

    if ("invalidTime" in result) {
      return Response.json(
        { error: "End time must be after the start time." },
        { status: 400 },
      );
    }

    return Response.json({ shift: result.shift });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (isDuplicate(error)) {
      return Response.json(
        { error: "This school already has a shift with conflicting details." },
        { status: 409 },
      );
    }

    return Response.json(
      { error: "Unable to update study shift." },
      { status: 500 },
    );
  }
}
