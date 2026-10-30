import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = { params: Promise<{ schoolId: string }> };

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.ACADEMIC_HEAD,
];

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, managementRoles);

    const academicYears = await prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: "desc" },
      include: {
        terms: { orderBy: { sequence: "asc" } },
        _count: { select: { sections: true, enrollments: true } },
      },
    });

    return Response.json({ academicYears });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to list academic years:", error);
    return Response.json({ error: "Unable to load academic years." }, { status: 500 });
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Enter the academic year details." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const startDate = parseDate(data.startDate);
    const endDate = parseDate(data.endDate);
    const isCurrent = data.isCurrent === true;

    if (!name || name.length > 80) {
      return Response.json(
        { error: "Academic year name is required and must not exceed 80 characters." },
        { status: 400 },
      );
    }
    if (!startDate || !endDate) {
      return Response.json(
        { error: "Enter valid start and end dates in YYYY-MM-DD format." },
        { status: 400 },
      );
    }
    if (startDate > endDate) {
      return Response.json(
        { error: "The start date must be on or before the end date." },
        { status: 400 },
      );
    }

    const academicYear = await prisma.$transaction(async (tx) => {
      if (isCurrent) {
        await tx.academicYear.updateMany({
          where: { schoolId, isCurrent: true },
          data: { isCurrent: false },
        });
      }

      const created = await tx.academicYear.create({
        data: { schoolId, name, startDate, endDate, isCurrent },
        include: { terms: true },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "ACADEMIC_YEAR_CREATED",
        resourceType: "AcademicYear",
        resourceId: created.id,
        metadata: {
          name,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          isCurrent,
        },
      }, request);

      return created;
    });

    return Response.json({ academicYear }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        { error: "An academic year with that name already exists." },
        { status: 409 },
      );
    }

    console.error("Failed to create academic year:", error);
    return Response.json({ error: "Unable to create the academic year." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      managementRoles,
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Enter the academic year details." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const id = typeof data.id === "string" ? data.id.trim() : "";
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const startDate = parseDate(data.startDate);
    const endDate = parseDate(data.endDate);
    const isCurrent = data.isCurrent;

    if (!id) return Response.json({ error: "Academic year ID is required." }, { status: 400 });
    if (!name || name.length > 80) {
      return Response.json({ error: "Academic year name is required and must not exceed 80 characters." }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return Response.json({ error: "Enter valid start and end dates in YYYY-MM-DD format." }, { status: 400 });
    }
    if (startDate > endDate) {
      return Response.json({ error: "The start date must be on or before the end date." }, { status: 400 });
    }
    if (typeof isCurrent !== "boolean") {
      return Response.json({ error: "Specify whether this is the current academic year." }, { status: 400 });
    }

    const existing = await prisma.academicYear.findFirst({
      where: { id, schoolId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isCurrent: true,
      },
    });

    if (!existing) {
      return Response.json({ error: "Academic year not found." }, { status: 404 });
    }

    const terms = await prisma.term.findMany({
      where: { academicYearId: id },
      select: { name: true, startDate: true, endDate: true },
    });

    const invalidTerm = terms.find(
      (term) => term.startDate < startDate || term.endDate > endDate,
    );

    if (invalidTerm) {
      return Response.json({
        error: "New academic-year dates must contain every existing term. Update term " + invalidTerm.name + " first.",
      }, { status: 409 });
    }

    const academicYear = await prisma.$transaction(async (tx) => {
      if (isCurrent) {
        await tx.academicYear.updateMany({
          where: { schoolId, isCurrent: true, NOT: { id } },
          data: { isCurrent: false },
        });
      }

      const updated = await tx.academicYear.update({
        where: { id },
        data: { name, startDate, endDate, isCurrent },
        include: {
          terms: { orderBy: { sequence: "asc" } },
          _count: { select: { sections: true, enrollments: true } },
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "ACADEMIC_YEAR_UPDATED",
        resourceType: "AcademicYear",
        resourceId: id,
        metadata: {
          before: {
            name: existing.name,
            startDate: existing.startDate.toISOString(),
            endDate: existing.endDate.toISOString(),
            isCurrent: existing.isCurrent,
          },
          after: {
            name,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            isCurrent,
          },
        },
      }, request);

      return updated;
    });

    return Response.json({ academicYear });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "An academic year with that name already exists." }, { status: 409 });
    }

    console.error("Failed to update academic year:", error);
    return Response.json({ error: "Unable to update the academic year." }, { status: 500 });
  }
}
