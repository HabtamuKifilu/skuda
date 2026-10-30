import { NextRequest } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ schoolId: string }>;
};

const readRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const manageRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
] as const;

type Kind = "jobTitle" | "department";

function parseKind(value: unknown): Kind | null {
  return value === "jobTitle" || value === "department" ? value : null;
}

function parseObject(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validName(value: unknown): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 100;
}

function validDescription(value: unknown): boolean {
  return value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length <= 1000);
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...readRoles]);

    const [jobTitles, departments] = await Promise.all([
      prisma.jobTitle.findMany({
        where: { schoolId },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      }),
      prisma.department.findMany({
        where: { schoolId },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      }),
    ]);

    return Response.json({ jobTitles, departments });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to load school job structure:", error);
    return Response.json(
      { error: "Unable to load job titles and departments." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...manageRoles],
    );

    let body: Record<string, unknown> | null;
    try {
      body = parseObject(await request.json());
    } catch {
      return Response.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    if (
      !body ||
      Object.keys(body).some(
        (key) => !["kind", "name", "description"].includes(key),
      ) ||
      !parseKind(body.kind) ||
      !validName(body.name) ||
      !validDescription(body.description)
    ) {
      return Response.json(
        {
          error:
            "Provide kind (jobTitle or department), a name up to 100 characters, and an optional description up to 1,000 characters.",
        },
        { status: 400 },
      );
    }

    const kind = parseKind(body.kind)!;
    const name = (body.name as string).trim();
    const description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : null;

    const result = await prisma.$transaction(async (tx) => {
      if (kind === "jobTitle") {
        const duplicate = await tx.jobTitle.findFirst({
          where: {
            schoolId,
            name: { equals: name, mode: "insensitive" },
          },
          select: { id: true },
        });

        if (duplicate) {
          return {
            error: "A job title with this name already exists in this school.",
            status: 409 as const,
          };
        }

        const item = await tx.jobTitle.create({
          data: { schoolId, name, description },
        });

        await createAuditLog(
          tx,
          {
            actorId: authorization.userId,
            schoolId,
            action: "SCHOOL_JOB_TITLE_CREATED",
            resourceType: "JobTitle",
            resourceId: item.id,
            metadata: { name },
          },
          request,
        );

        return { item, kind };
      }

      const duplicate = await tx.department.findFirst({
        where: {
          schoolId,
          name: { equals: name, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (duplicate) {
        return {
          error: "A department with this name already exists in this school.",
          status: 409 as const,
        };
      }

      const item = await tx.department.create({
        data: { schoolId, name, description },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SCHOOL_DEPARTMENT_CREATED",
          resourceType: "Department",
          resourceId: item.id,
          metadata: { name },
        },
        request,
      );

      return { item, kind };
    });

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return Response.json(
      result.kind === "jobTitle"
        ? { jobTitle: result.item }
        : { department: result.item },
      { status: 201 },
    );
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to create school job structure item:", error);
    return Response.json(
      { error: "Unable to create the job title or department." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...manageRoles],
    );

    let body: Record<string, unknown> | null;
    try {
      body = parseObject(await request.json());
    } catch {
      return Response.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    if (
      !body ||
      Object.keys(body).some(
        (key) => !["kind", "id", "isActive"].includes(key),
      ) ||
      !parseKind(body.kind) ||
      typeof body.id !== "string" ||
      !body.id.trim() ||
      typeof body.isActive !== "boolean"
    ) {
      return Response.json(
        { error: "Provide kind, id, and a boolean isActive value." },
        { status: 400 },
      );
    }

    const kind = parseKind(body.kind)!;
    const id = body.id.trim();

    const result = await prisma.$transaction(async (tx) => {
      if (kind === "jobTitle") {
        const existing = await tx.jobTitle.findFirst({
          where: { id, schoolId },
          select: { id: true, name: true, isActive: true },
        });

        if (!existing) {
          return {
            error: "Job title not found in this school.",
            status: 404 as const,
          };
        }

        const item = await tx.jobTitle.update({
          where: { id },
          data: { isActive: body.isActive as boolean },
        });

        await createAuditLog(
          tx,
          {
            actorId: authorization.userId,
            schoolId,
            action: body.isActive
              ? "SCHOOL_JOB_TITLE_ACTIVATED"
              : "SCHOOL_JOB_TITLE_DEACTIVATED",
            resourceType: "JobTitle",
            resourceId: item.id,
            metadata: {
              name: existing.name,
              previousIsActive: existing.isActive,
              isActive: item.isActive,
            },
          },
          request,
        );

        return { item, kind };
      }

      const existing = await tx.department.findFirst({
        where: { id, schoolId },
        select: { id: true, name: true, isActive: true },
      });

      if (!existing) {
        return {
          error: "Department not found in this school.",
          status: 404 as const,
        };
      }

      const item = await tx.department.update({
        where: { id },
        data: { isActive: body.isActive as boolean },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: body.isActive
            ? "SCHOOL_DEPARTMENT_ACTIVATED"
            : "SCHOOL_DEPARTMENT_DEACTIVATED",
          resourceType: "Department",
          resourceId: item.id,
          metadata: {
            name: existing.name,
            previousIsActive: existing.isActive,
            isActive: item.isActive,
          },
        },
        request,
      );

      return { item, kind };
    });

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return Response.json(
      result.kind === "jobTitle"
        ? { jobTitle: result.item }
        : { department: result.item },
    );
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to update school job structure item:", error);
    return Response.json(
      { error: "Unable to update the job title or department." },
      { status: 500 },
    );
  }
}
