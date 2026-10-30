import { NextRequest } from "next/server";
import {
  EmploymentType,
  JobOpeningStatus,
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

type RouteContext = { params: Promise<{ schoolId: string }> };

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

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, recruitmentRoles);

    const query = request.nextUrl.searchParams.get("q")?.trim();

    const jobs = await prisma.jobOpening.findMany({
      where: {
        schoolId,
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { department: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { title: "asc" }],
      select: selectOpening,
    });

    return Response.json({ jobs });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    return Response.json(
      { error: "Unable to load job openings." },
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
      recruitmentRoles,
    );

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "A valid request body is required." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const department =
      typeof data.department === "string"
        ? data.department.trim() || null
        : null;
    const description =
      typeof data.description === "string"
        ? data.description.trim() || null
        : null;

    const employmentType =
      typeof data.employmentType === "string" &&
      Object.values(EmploymentType).includes(data.employmentType as EmploymentType)
        ? (data.employmentType as EmploymentType)
        : EmploymentType.PERMANENT;

    const status =
      typeof data.status === "string" &&
      Object.values(JobOpeningStatus).includes(data.status as JobOpeningStatus)
        ? (data.status as JobOpeningStatus)
        : JobOpeningStatus.DRAFT;

    const isPublished = data.isPublished === true;
    const openingDate = parseOptionalDate(data.openingDate);
    const closingDate = parseOptionalDate(data.closingDate);

    if (!title || title.length > 160) {
      return Response.json(
        { error: "Job title is required and must be 160 characters or fewer." },
        { status: 400 },
      );
    }

    if (department && department.length > 120) {
      return Response.json(
        { error: "Department must be 120 characters or fewer." },
        { status: 400 },
      );
    }

    if (description && description.length > 10000) {
      return Response.json(
        { error: "Description must be 10,000 characters or fewer." },
        { status: 400 },
      );
    }

    if (
      openingDate === undefined ||
      closingDate === undefined ||
      (openingDate && closingDate && closingDate < openingDate)
    ) {
      return Response.json(
        { error: "Provide valid dates, with the closing date on or after the opening date." },
        { status: 400 },
      );
    }

    if (isPublished && status !== JobOpeningStatus.OPEN) {
      return Response.json(
        { error: "Only open vacancies can be published." },
        { status: 400 },
      );
    }

    if (isPublished && closingDate && closingDate < new Date()) {
      return Response.json(
        { error: "An expired vacancy cannot be published." },
        { status: 400 },
      );
    }

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.jobOpening.create({
        data: {
          schoolId,
          title,
          department,
          description,
          employmentType,
          status,
          isPublished,
          openingDate,
          closingDate,
        },
        select: selectOpening,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "JOB_OPENING_CREATED",
          resourceType: "JobOpening",
          resourceId: created.id,
          metadata: {
            title,
            department,
            employmentType,
            status,
            isPublished,
          },
        },
        request,
      );

      return created;
    });

    return Response.json({ job }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    return Response.json(
      { error: "Unable to create the job opening." },
      { status: 500 },
    );
  }
}
