import { NextRequest } from "next/server";
import {
  EmploymentType,
  JobOpeningStatus,
  Prisma,
  SchoolMembershipRole,
} from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const recruitmentRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
];

type RouteContext = {
  params: Promise<{ schoolId: string; jobOpeningId: string }>;
};

const selectOpening = {
  id: true,
  title: true,
  department: true,
  description: true,
  employmentType: true,
  status: true,
  isPublished: true,
  openingDate: true,
  closingDate: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { applications: true } },
} as const;

function parseDate(value: unknown): Date | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, jobOpeningId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, recruitmentRoles);

    const job = await prisma.jobOpening.findFirst({
      where: { id: jobOpeningId, schoolId },
      select: selectOpening,
    });

    if (!job) {
      return Response.json({ error: "Job opening not found." }, { status: 404 });
    }

    return Response.json({ job });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    return Response.json(
      { error: "Unable to load the job opening." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, jobOpeningId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      recruitmentRoles,
    );

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "A valid request body is required." },
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;
    const update: Prisma.JobOpeningUpdateInput = {};

    if ("title" in input) {
      if (
        typeof input.title !== "string" ||
        !input.title.trim() ||
        input.title.trim().length > 160
      ) {
        return Response.json(
          { error: "Title is required and must be 160 characters or fewer." },
          { status: 400 },
        );
      }
      update.title = input.title.trim();
    }

    if ("department" in input) {
      if (input.department !== null && typeof input.department !== "string") {
        return Response.json(
          { error: "Department must be text." },
          { status: 400 },
        );
      }

      const department =
        typeof input.department === "string" ? input.department.trim() : "";

      if (department.length > 120) {
        return Response.json(
          { error: "Department must be 120 characters or fewer." },
          { status: 400 },
        );
      }

      update.department = department || null;
    }

    if ("description" in input) {
      if (input.description !== null && typeof input.description !== "string") {
        return Response.json(
          { error: "Description must be text." },
          { status: 400 },
        );
      }

      const description =
        typeof input.description === "string" ? input.description.trim() : "";

      if (description.length > 10000) {
        return Response.json(
          { error: "Description must be 10,000 characters or fewer." },
          { status: 400 },
        );
      }

      update.description = description || null;
    }

    if ("employmentType" in input) {
      if (
        typeof input.employmentType !== "string" ||
        !Object.values(EmploymentType).includes(
          input.employmentType as EmploymentType,
        )
      ) {
        return Response.json(
          { error: "Select a valid employment type." },
          { status: 400 },
        );
      }
      update.employmentType = input.employmentType as EmploymentType;
    }

    if ("status" in input) {
      if (
        typeof input.status !== "string" ||
        !Object.values(JobOpeningStatus).includes(
          input.status as JobOpeningStatus,
        )
      ) {
        return Response.json(
          { error: "Select a valid job status." },
          { status: 400 },
        );
      }
      update.status = input.status as JobOpeningStatus;
    }

    if ("isPublished" in input) {
      if (typeof input.isPublished !== "boolean") {
        return Response.json(
          { error: "Published status must be true or false." },
          { status: 400 },
        );
      }
      update.isPublished = input.isPublished;
    }

    if ("openingDate" in input) {
      const date = parseDate(input.openingDate);
      if (date === undefined) {
        return Response.json(
          { error: "Opening date must be a valid date." },
          { status: 400 },
        );
      }
      update.openingDate = date;
    }

    if ("closingDate" in input) {
      const date = parseDate(input.closingDate);
      if (date === undefined) {
        return Response.json(
          { error: "Closing date must be a valid date." },
          { status: 400 },
        );
      }
      update.closingDate = date;
    }

    if (Object.keys(update).length === 0) {
      return Response.json(
        { error: "Provide at least one valid field to update." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.jobOpening.findFirst({
        where: { id: jobOpeningId, schoolId },
        select: {
          id: true,
          status: true,
          isPublished: true,
          openingDate: true,
          closingDate: true,
        },
      });

      if (!existing) return { notFound: true as const };

      const nextStatus = update.status ?? existing.status;
      const nextOpeningDate =
        update.openingDate !== undefined
          ? update.openingDate
          : existing.openingDate;
      const nextClosingDate =
        update.closingDate !== undefined
          ? update.closingDate
          : existing.closingDate;

      if (
        nextOpeningDate &&
        nextClosingDate &&
        nextClosingDate < nextOpeningDate
      ) {
        return { invalidDates: true as const };
      }

      if (
        update.isPublished === true &&
        nextStatus !== JobOpeningStatus.OPEN
      ) {
        return { notOpen: true as const };
      }

      if (
        update.isPublished === true &&
        nextClosingDate &&
        nextClosingDate < new Date()
      ) {
        return { expired: true as const };
      }

      // A non-open vacancy must not remain publicly published.
      if (nextStatus !== JobOpeningStatus.OPEN) {
        update.isPublished = false;
      }

      const nextPublished = update.isPublished ?? existing.isPublished;

      if (
        nextPublished &&
        nextClosingDate &&
        nextClosingDate < new Date()
      ) {
        return { expired: true as const };
      }

      const updated = await tx.jobOpening.update({
        where: { id: existing.id },
        data: update,
        select: selectOpening,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action:
            updated.isPublished !== existing.isPublished
              ? updated.isPublished
                ? "JOB_OPENING_PUBLISHED"
                : "JOB_OPENING_UNPUBLISHED"
              : updated.status !== nextStatus
                ? "JOB_OPENING_STATUS_UPDATED"
                : "JOB_OPENING_UPDATED",
          resourceType: "JobOpening",
          resourceId: updated.id,
          metadata: {
            changedFields: Object.keys(update),
            status: updated.status,
            isPublished: updated.isPublished,
          },
        },
        request,
      );

      return { job: updated };
    });

    if ("notFound" in result) {
      return Response.json({ error: "Job opening not found." }, { status: 404 });
    }

    if ("invalidDates" in result) {
      return Response.json(
        { error: "Closing date must be on or after the opening date." },
        { status: 400 },
      );
    }

    if ("notOpen" in result) {
      return Response.json(
        { error: "Only open vacancies can be published." },
        { status: 400 },
      );
    }

    if ("expired" in result) {
      return Response.json(
        { error: "An expired vacancy cannot be published." },
        { status: 400 },
      );
    }

    return Response.json({ job: result.job });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    return Response.json(
      { error: "Unable to update the job opening." },
      { status: 500 },
    );
  }
}
