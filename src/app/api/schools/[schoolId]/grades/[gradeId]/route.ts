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
  params: Promise<{ schoolId: string; gradeId: string }>;
};

function isDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, gradeId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      managementRoles,
    );

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "A valid request body is required." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const update: {
      name?: string;
      code?: string;
      level?: number;
      description?: string | null;
      isActive?: boolean;
    } = {};

    if ("name" in data) {
      if (typeof data.name !== "string" || !data.name.trim() || data.name.trim().length > 100) {
        return Response.json({ error: "Enter a grade name of up to 100 characters." }, { status: 400 });
      }
      update.name = data.name.trim();
    }

    if ("code" in data) {
      if (typeof data.code !== "string" || !data.code.trim() || data.code.trim().length > 30) {
        return Response.json({ error: "Enter a grade code of up to 30 characters." }, { status: 400 });
      }
      update.code = data.code.trim().toUpperCase();
    }

    if ("level" in data) {
      if (typeof data.level !== "number" || !Number.isInteger(data.level) || data.level < 1 || data.level > 100) {
        return Response.json({ error: "Level must be a whole number between 1 and 100." }, { status: 400 });
      }
      update.level = data.level;
    }

    if ("description" in data) {
      if (data.description !== null && typeof data.description !== "string") {
        return Response.json({ error: "Description must be text." }, { status: 400 });
      }
      const description = typeof data.description === "string" ? data.description.trim() : "";
      if (description.length > 500) {
        return Response.json({ error: "Description must be 500 characters or fewer." }, { status: 400 });
      }
      update.description = description || null;
    }

    if ("isActive" in data) {
      if (typeof data.isActive !== "boolean") {
        return Response.json({ error: "Active status must be true or false." }, { status: 400 });
      }
      update.isActive = data.isActive;
    }

    if (Object.keys(update).length === 0) {
      return Response.json({ error: "Provide at least one field to update." }, { status: 400 });
    }

    const grade = await prisma.$transaction(async (tx) => {
      const existing = await tx.grade.findFirst({
        where: { id: gradeId, schoolId },
        select: { id: true },
      });

      if (!existing) return null;

      const updated = await tx.grade.update({
        where: { id: existing.id },
        data: update,
        select: {
          id: true,
          name: true,
          code: true,
          level: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { sections: true, enrollments: true } },
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: update.isActive === false
          ? "GRADE_DEACTIVATED"
          : update.isActive === true
            ? "GRADE_ACTIVATED"
            : "GRADE_UPDATED",
        resourceType: "Grade",
        resourceId: updated.id,
        metadata: update,
      }, request);

      return updated;
    });

    if (!grade) {
      return Response.json({ error: "Grade not found in this school." }, { status: 404 });
    }

    return Response.json({ grade });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (isDuplicate(error)) {
      return Response.json(
        { error: "A grade with this name, code, or level already exists in this school." },
        { status: 409 },
      );
    }

    return Response.json({ error: "Unable to update grade." }, { status: 500 });
  }
}
