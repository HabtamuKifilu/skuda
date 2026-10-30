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
  params: Promise<{ schoolId: string; subjectId: string }>;
};

function isDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

const subjectSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { offerings: true } },
} satisfies Prisma.SubjectSelect;

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, subjectId } = await context.params;
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
    const allowedFields = ["name", "code", "description", "isActive"];
    const suppliedFields = allowedFields.filter((field) =>
      Object.prototype.hasOwnProperty.call(data, field),
    );

    if (suppliedFields.length === 0) {
      return Response.json(
        { error: "Provide at least one subject field to update." },
        { status: 400 },
      );
    }

    const updates: Prisma.SubjectUpdateInput = {};
    const changes: Record<string, string | boolean | null> = {};

    if (Object.prototype.hasOwnProperty.call(data, "name")) {
      const name = typeof data.name === "string" ? data.name.trim() : "";

      if (!name || name.length > 100) {
        return Response.json(
          { error: "Enter a subject name of up to 100 characters." },
          { status: 400 },
        );
      }

      updates.name = name;
      changes.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(data, "code")) {
      const code =
        typeof data.code === "string" ? data.code.trim().toUpperCase() : "";

      if (!code || code.length > 30) {
        return Response.json(
          { error: "Enter a subject code of up to 30 characters." },
          { status: 400 },
        );
      }

      updates.code = code;
      changes.code = code;
    }

    if (Object.prototype.hasOwnProperty.call(data, "description")) {
      if (data.description !== null && typeof data.description !== "string") {
        return Response.json(
          { error: "Description must be text or null." },
          { status: 400 },
        );
      }

      const description =
        typeof data.description === "string"
          ? data.description.trim() || null
          : null;

      if (description && description.length > 500) {
        return Response.json(
          { error: "Description must be 500 characters or fewer." },
          { status: 400 },
        );
      }

      updates.description = description;
      changes.description = description;
    }

    if (Object.prototype.hasOwnProperty.call(data, "isActive")) {
      if (typeof data.isActive !== "boolean") {
        return Response.json(
          { error: "isActive must be true or false." },
          { status: 400 },
        );
      }

      updates.isActive = data.isActive;
      changes.isActive = data.isActive;
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.subject.findFirst({
        where: { id: subjectId, schoolId },
        select: { id: true },
      });

      if (!existing) {
        return {
          error: "Subject not found in this school.",
          status: 404,
        } as const;
      }

      const subject = await tx.subject.update({
        where: { id: existing.id },
        data: updates,
        select: subjectSelect,
      });

      const action =
        changes.isActive === true
          ? "SUBJECT_ACTIVATED"
          : changes.isActive === false
            ? "SUBJECT_DEACTIVATED"
            : "SUBJECT_UPDATED";

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action,
          resourceType: "Subject",
          resourceId: subject.id,
          metadata: { changes },
        },
        request,
      );

      return { subject } as const;
    });

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return Response.json({ subject: result.subject });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (isDuplicate(error)) {
      return Response.json(
        { error: "A subject with this name or code already exists in this school." },
        { status: 409 },
      );
    }

    console.error("Failed to update subject:", error);
    return Response.json(
      { error: "Unable to update subject." },
      { status: 500 },
    );
  }
}
