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

const subjectSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { offerings: true },
  },
} satisfies Prisma.SubjectSelect;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, managementRoles);

    const subjects = await prisma.subject.findMany({
      where: { schoolId },
      orderBy: [{ name: "asc" }],
      select: subjectSelect,
    });

    return Response.json({ subjects });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to list subjects:", error);
    return Response.json(
      { error: "Unable to load subjects." },
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
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const code =
      typeof data.code === "string"
        ? data.code.trim().toUpperCase()
        : "";
    const description =
      typeof data.description === "string"
        ? data.description.trim() || null
        : data.description === null || data.description === undefined
          ? null
          : undefined;

    if (!name || name.length > 100) {
      return Response.json(
        { error: "Enter a subject name of up to 100 characters." },
        { status: 400 },
      );
    }

    if (!code || code.length > 30) {
      return Response.json(
        { error: "Enter a subject code of up to 30 characters." },
        { status: 400 },
      );
    }

    if (description === undefined) {
      return Response.json(
        { error: "Description must be text or left blank." },
        { status: 400 },
      );
    }

    if (description && description.length > 500) {
      return Response.json(
        { error: "Description must be 500 characters or fewer." },
        { status: 400 },
      );
    }

    const subject = await prisma.$transaction(async (tx) => {
      const created = await tx.subject.create({
        data: {
          schoolId,
          name,
          code,
          description,
        },
        select: subjectSelect,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SUBJECT_CREATED",
          resourceType: "Subject",
          resourceId: created.id,
          metadata: { name, code, description },
        },
        request,
      );

      return created;
    });

    return Response.json({ subject }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (isDuplicate(error)) {
      return Response.json(
        {
          error:
            "A subject with this name or code already exists in this school.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to create subject:", error);
    return Response.json(
      { error: "Unable to create subject." },
      { status: 500 },
    );
  }
}
