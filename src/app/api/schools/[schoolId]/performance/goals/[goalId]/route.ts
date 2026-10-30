import { NextRequest, NextResponse } from "next/server";
import {
  SchoolMembershipRole,
  StaffPerformanceGoalPriority,
  StaffPerformanceGoalStatus,
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

type Context = {
  params: Promise<{ schoolId: string; goalId: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(error: unknown): Response {
  const response = authorizationErrorResponse(error);
  if (response) return response;
  console.error("Performance goal API error:", error);
  return Response.json({ error: "An unexpected error occurred." }, { status: 500 });
}

function parseDecimal(value: unknown): number | null | undefined {
  if (value === null || value === "") return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 9_999_999_999.99 ||
    Math.round(value * 100) !== value * 100
  ) return undefined;
  return value;
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, goalId } = await context.params;
    const authorization = await requireSchoolMembership(request.headers, schoolId);
    const isManager = authorization.roles.some((role) =>
      MANAGERS.includes(role as (typeof MANAGERS)[number]),
    );

    if (!isManager) {
      return NextResponse.json({ error: "You are not authorized to edit performance goals." }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
    }
    if (!isRecord(body)) {
      return NextResponse.json({ error: "The request body must be an object." }, { status: 400 });
    }

    const existing = await prisma.staffPerformanceGoal.findFirst({
      where: { id: goalId, schoolId },
      select: {
        id: true,
        status: true,
        startDate: true,
        dueDate: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Performance goal not found." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if ("title" in body) {
      if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 200) {
        return NextResponse.json({ error: "Title is required and must not exceed 200 characters." }, { status: 400 });
      }
      data.title = body.title.trim();
    }

    if ("category" in body) {
      if (typeof body.category !== "string" || !body.category.trim() || body.category.trim().length > 100) {
        return NextResponse.json({ error: "Category is required and must not exceed 100 characters." }, { status: 400 });
      }
      data.category = body.category.trim();
    }

    for (const field of ["description", "unit", "successCriteria"] as const) {
      if (!(field in body)) continue;
      const value = body[field];
      const maxLength = field === "description" ? 5000 : field === "unit" ? 50 : 3000;
      if (value !== null && typeof value !== "string") {
        return NextResponse.json({ error: `${field} must be text or null.` }, { status: 400 });
      }
      if (typeof value === "string" && value.trim().length > maxLength) {
        return NextResponse.json({ error: `${field} exceeds its maximum length.` }, { status: 400 });
      }
      data[field] = typeof value === "string" ? value.trim() || null : null;
    }

    for (const field of ["targetValue", "baselineValue", "currentValue"] as const) {
      if (!(field in body)) continue;
      const value = parseDecimal(body[field]);
      if (value === undefined || (field === "targetValue" && (value === null || value <= 0))) {
        return NextResponse.json({ error: `${field} must be a valid non-negative number with at most two decimal places; targetValue must be positive.` }, { status: 400 });
      }
      data[field] = value;
    }

    if ("priority" in body) {
      if (
        typeof body.priority !== "string" ||
        !Object.values(StaffPerformanceGoalPriority).includes(body.priority as StaffPerformanceGoalPriority)
      ) {
        return NextResponse.json({ error: "Priority is invalid." }, { status: 400 });
      }
      data.priority = body.priority;
    }

    let nextStartDate: Date | null | undefined = existing.startDate;
    let nextDueDate: Date | null | undefined = existing.dueDate;

    if ("startDate" in body) {
      nextStartDate = parseDate(body.startDate);
      if (nextStartDate === undefined) {
        return NextResponse.json({ error: "Start date is invalid." }, { status: 400 });
      }
      data.startDate = nextStartDate;
    }

    if ("dueDate" in body) {
      nextDueDate = parseDate(body.dueDate);
      if (nextDueDate === undefined) {
        return NextResponse.json({ error: "Due date is invalid." }, { status: 400 });
      }
      data.dueDate = nextDueDate;
    }

    if (nextStartDate && nextDueDate && nextDueDate < nextStartDate) {
      return NextResponse.json({ error: "Due date cannot be earlier than the start date." }, { status: 400 });
    }

    if ("status" in body) {
      if (
        typeof body.status !== "string" ||
        !Object.values(StaffPerformanceGoalStatus).includes(body.status as StaffPerformanceGoalStatus)
      ) {
        return NextResponse.json({ error: "Status is invalid." }, { status: 400 });
      }

      const nextStatus = body.status as StaffPerformanceGoalStatus;
      const allowed =
        nextStatus === existing.status ||
        (existing.status === StaffPerformanceGoalStatus.DRAFT &&
          (nextStatus === StaffPerformanceGoalStatus.ACTIVE ||
            nextStatus === StaffPerformanceGoalStatus.CANCELLED)) ||
        (existing.status === StaffPerformanceGoalStatus.ACTIVE &&
          (nextStatus === StaffPerformanceGoalStatus.COMPLETED ||
            nextStatus === StaffPerformanceGoalStatus.CANCELLED));

      if (!allowed) {
        return NextResponse.json({ error: "This goal status transition is not allowed." }, { status: 409 });
      }

      data.status = nextStatus;
      if (nextStatus === StaffPerformanceGoalStatus.COMPLETED) {
        data.completedAt = new Date();
      } else if (existing.status === StaffPerformanceGoalStatus.COMPLETED) {
        data.completedAt = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No editable fields were provided." }, { status: 400 });
    }

    const goal = await prisma.$transaction(async (tx) => {
      const updated = await tx.staffPerformanceGoal.update({
        where: { id_schoolId: { id: goalId, schoolId } },
        data,
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
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_PERFORMANCE_GOAL_UPDATED",
        resourceType: "StaffPerformanceGoal",
        resourceId: updated.id,
        metadata: {
          changedFields: Object.keys(data),
          previousStatus: existing.status,
          status: updated.status,
        },
      }, request);

      return updated;
    });

    return NextResponse.json({ goal });
  } catch (error) {
    return errorResponse(error);
  }
}
