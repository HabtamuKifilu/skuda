import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string; academicYearId: string; termId: string }>;
};

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.ACADEMIC_HEAD,
];

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, academicYearId, termId } = await context.params;
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
      return Response.json({ error: "Enter the term details." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const startDate = parseDate(data.startDate);
    const endDate = parseDate(data.endDate);
    const sequence = data.sequence;
    const isCurrent = data.isCurrent;

    if (!name || name.length > 80) {
      return Response.json({ error: "Term name is required and must not exceed 80 characters." }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return Response.json({ error: "Enter valid start and end dates in YYYY-MM-DD format." }, { status: 400 });
    }
    if (startDate > endDate) {
      return Response.json({ error: "The term start date must be on or before its end date." }, { status: 400 });
    }
    if (!Number.isSafeInteger(sequence) || (sequence as number) < 1) {
      return Response.json({ error: "Term sequence must be a positive whole number." }, { status: 400 });
    }
    if (typeof isCurrent !== "boolean") {
      return Response.json({ error: "Specify whether this is the current term." }, { status: 400 });
    }

    const academicYear = await prisma.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!academicYear) {
      return Response.json({ error: "Academic year not found." }, { status: 404 });
    }
    if (startDate < academicYear.startDate || endDate > academicYear.endDate) {
      return Response.json({ error: "Term dates must fall within the academic-year dates." }, { status: 400 });
    }

    const existing = await prisma.term.findFirst({
      where: { id: termId, academicYearId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        sequence: true,
        isCurrent: true,
      },
    });
    if (!existing) {
      return Response.json({ error: "Term not found in this academic year." }, { status: 404 });
    }

    const term = await prisma.$transaction(async (tx) => {
      if (isCurrent) {
        await tx.term.updateMany({
          where: { academicYearId, isCurrent: true, NOT: { id: termId } },
          data: { isCurrent: false },
        });
      }

      const updated = await tx.term.update({
        where: { id: termId },
        data: { name, startDate, endDate, sequence: sequence as number, isCurrent },
        include: { _count: { select: { assessments: true } } },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "TERM_UPDATED",
        resourceType: "Term",
        resourceId: termId,
        metadata: {
          academicYearId,
          before: {
            name: existing.name,
            startDate: existing.startDate.toISOString(),
            endDate: existing.endDate.toISOString(),
            sequence: existing.sequence,
            isCurrent: existing.isCurrent,
          },
          after: {
            name,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            sequence: sequence as number,
            isCurrent,
          },
        },
      }, request);

      return updated;
    });

    return Response.json({ term });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "A term with that name or sequence already exists in this academic year." }, { status: 409 });
    }
    console.error("Failed to update term:", error);
    return Response.json({ error: "Unable to update the term." }, { status: 500 });
  }
}
