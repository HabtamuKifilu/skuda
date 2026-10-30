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

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, managementRoles);

    const grades = await prisma.grade.findMany({
      where: { schoolId },
      orderBy: [{ level: "asc" }, { name: "asc" }],
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

    return Response.json({ grades });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    return Response.json({ error: "Unable to load grades." }, { status: 500 });
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
      return Response.json({ error: "A valid request body is required." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const code = typeof data.code === "string" ? data.code.trim().toUpperCase() : "";
    const level = data.level;
    const description =
      typeof data.description === "string" ? data.description.trim() || null : null;

    if (!name || name.length > 100) {
      return Response.json({ error: "Enter a grade name of up to 100 characters." }, { status: 400 });
    }
    if (!code || code.length > 30) {
      return Response.json({ error: "Enter a grade code of up to 30 characters." }, { status: 400 });
    }
    if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 100) {
      return Response.json({ error: "Level must be a whole number between 1 and 100." }, { status: 400 });
    }
    if (description && description.length > 500) {
      return Response.json({ error: "Description must be 500 characters or fewer." }, { status: 400 });
    }

    const grade = await prisma.$transaction(async (tx) => {
      const created = await tx.grade.create({
        data: { schoolId, name, code, level, description },
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
        action: "GRADE_CREATED",
        resourceType: "Grade",
        resourceId: created.id,
        metadata: { name, code, level },
      }, request);

      return created;
    });

    return Response.json({ grade }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (isDuplicate(error)) {
      return Response.json(
        { error: "A grade with this name, code, or level already exists in this school." },
        { status: 409 },
      );
    }

    return Response.json({ error: "Unable to create grade." }, { status: 500 });
  }
}
