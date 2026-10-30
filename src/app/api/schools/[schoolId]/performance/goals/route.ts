import { NextRequest, NextResponse } from "next/server";
import {
  SchoolMembershipRole,
  StaffPerformanceGoalPriority,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolMembership } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const MANAGERS = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

type Context = { params: Promise<{ schoolId: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(error: unknown): Response {
  const response = authorizationErrorResponse(error);
  if (response) return response;

  console.error("Performance goals API error:", error);
  return Response.json(
    { error: "An unexpected error occurred." },
    { status: 500 },
  );
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function parseDecimal(
  value: unknown,
  required = false,
): number | null | undefined {
  if (value === undefined || value === null || value === "") {
    return required ? undefined : null;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 9_999_999_999.99 ||
    Math.round(value * 100) !== value * 100
  ) {
    return undefined;
  }

  if (required && value <= 0) return undefined;
  return value;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolMembership(
      request.headers,
      schoolId,
    );

    const isManager = authorization.roles.some((role) =>
      MANAGERS.includes(role as (typeof MANAGERS)[number]),
    );

    const goals = await prisma.staffPerformanceGoal.findMany({
      where: {
        schoolId,
        ...(isManager
          ? {}
          : { staffProfile: { userId: authorization.userId } }),
      },
      orderBy: [
        { status: "asc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        staffProfile: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            jobTitle: true,
            department: true,
            userId: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        progressUpdates: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            recordedBy: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ goals });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolMembership(
      request.headers,
      schoolId,
    );

    const isManager = authorization.roles.some((role) =>
      MANAGERS.includes(role as (typeof MANAGERS)[number]),
    );

    if (!isManager) {
      return NextResponse.json(
        { error: "You are not authorized to create performance goals." },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "A valid JSON request body is required." },
        { status: 400 },
      );
    }

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "The request body must be an object." },
        { status: 400 },
      );
    }

    const staffProfileId =
      typeof body.staffProfileId === "string"
        ? body.staffProfileId.trim()
        : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const category =
      typeof body.category === "string" ? body.category.trim() : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;
    const unit = typeof body.unit === "string" ? body.unit.trim() : null;
    const successCriteria =
      typeof body.successCriteria === "string"
        ? body.successCriteria.trim()
        : null;

    if (!staffProfileId) {
      return NextResponse.json(
        { error: "An assigned staff member is required." },
        { status: 400 },
      );
    }

    if (!title || title.length > 200) {
      return NextResponse.json(
        { error: "Title is required and must not exceed 200 characters." },
        { status: 400 },
      );
    }

    if (!category || category.length > 100) {
      return NextResponse.json(
        { error: "Category is required and must not exceed 100 characters." },
        { status: 400 },
      );
    }

    if (
      (description !== null && description.length > 5000) ||
      (unit !== null && unit.length > 50) ||
      (successCriteria !== null && successCriteria.length > 3000)
    ) {
      return NextResponse.json(
        { error: "One or more optional fields exceed their allowed length." },
        { status: 400 },
      );
    }

    if (
      body.description !== undefined &&
      body.description !== null &&
      typeof body.description !== "string"
    ) {
      return NextResponse.json(
        { error: "Description must be text." },
        { status: 400 },
      );
    }

    if (
      body.unit !== undefined &&
      body.unit !== null &&
      typeof body.unit !== "string"
    ) {
      return NextResponse.json(
        { error: "Unit must be text." },
        { status: 400 },
      );
    }

    if (
      body.successCriteria !== undefined &&
      body.successCriteria !== null &&
      typeof body.successCriteria !== "string"
    ) {
      return NextResponse.json(
        { error: "Success criteria must be text." },
        { status: 400 },
      );
    }

    const targetValue = parseDecimal(body.targetValue, true);
    const baselineValue = parseDecimal(body.baselineValue);
    const currentValue = parseDecimal(body.currentValue);

    if (
      targetValue === undefined ||
      baselineValue === undefined ||
      currentValue === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Target must be positive; baseline and current values must be non-negative numbers with at most two decimal places.",
        },
        { status: 400 },
      );
    }

    const startDate = parseDate(body.startDate);
    const dueDate = parseDate(body.dueDate);

    if (startDate === undefined || dueDate === undefined) {
      return NextResponse.json(
        { error: "Start date or due date is invalid." },
        { status: 400 },
      );
    }

    if (startDate && dueDate && dueDate < startDate) {
      return NextResponse.json(
        { error: "Due date cannot be earlier than the start date." },
        { status: 400 },
      );
    }

    const priority =
      body.priority === undefined
        ? StaffPerformanceGoalPriority.NORMAL
        : body.priority;

    if (
      typeof priority !== "string" ||
      !Object.values(StaffPerformanceGoalPriority).includes(
        priority as StaffPerformanceGoalPriority,
      )
    ) {
      return NextResponse.json(
        { error: "Priority is invalid." },
        { status: 400 },
      );
    }

    const staffProfile = await prisma.staffProfile.findFirst({
      where: {
        id: staffProfileId,
        schoolId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!staffProfile) {
      return NextResponse.json(
        { error: "The assigned staff member was not found or is not active in this school." },
        { status: 404 },
      );
    }

    const goal = await prisma.$transaction(async (tx) => {
      const created = await tx.staffPerformanceGoal.create({
        data: {
          schoolId,
          staffProfileId,
          createdById: authorization.userId,
          title,
          description: description || null,
          category,
          targetValue: targetValue as number,
          baselineValue: baselineValue ?? null,
          currentValue: currentValue ?? null,
          unit: unit || null,
          successCriteria: successCriteria || null,
          priority: priority as StaffPerformanceGoalPriority,
          startDate: startDate ?? null,
          dueDate: dueDate ?? null,
        },
        include: {
          staffProfile: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
              jobTitle: true,
              department: true,
              userId: true,
            },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_PERFORMANCE_GOAL_CREATED",
          resourceType: "StaffPerformanceGoal",
          resourceId: created.id,
          metadata: {
            title: created.title,
            staffProfileId,
            category,
            targetValue: String(created.targetValue),
            priority: created.priority,
          },
        },
        request,
      );

      return created;
    });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
