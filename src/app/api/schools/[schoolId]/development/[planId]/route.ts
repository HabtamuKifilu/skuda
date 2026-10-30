import { NextRequest, NextResponse } from "next/server";
import {
  SchoolMembershipRole,
  StaffDevelopmentPlanStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const MANAGERS = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

type Context = { params: Promise<{ schoolId: string; planId: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function optionalText(value: unknown, max: number, field: string) {
  if (value === undefined || value === null || value === "") {
    return { value: null as string | null };
  }
  if (typeof value !== "string" || value.trim().length > max) {
    return { error: `${field} must be text of at most ${max} characters.` };
  }
  return { value: value.trim() || null };
}

function errorResponse(error: unknown) {
  const response = authorizationErrorResponse(error);
  if (response) return response;
  console.error("Staff development plan update error:", error);
  return NextResponse.json({ error: "Unable to update the development plan." }, { status: 500 });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, planId } = await context.params;
    const authorization = await requireSchoolRole(request.headers, schoolId, [...MANAGERS]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    if (!isRecord(body)) {
      return NextResponse.json({ error: "A plan update is required." }, { status: 400 });
    }

    const allowed = ["title", "description", "startDate", "targetDate", "notes", "status"];
    if (Object.keys(body).length === 0 || Object.keys(body).some((key) => !allowed.includes(key))) {
      return NextResponse.json({ error: "The request is empty or contains unsupported fields." }, { status: 400 });
    }

    if (body.title !== undefined &&
      (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 160)) {
      return NextResponse.json({ error: "Title is required and must be at most 160 characters." }, { status: 400 });
    }

    const description = body.description === undefined ? undefined : optionalText(body.description, 4000, "Description");
    if (description && "error" in description) {
      return NextResponse.json({ error: description.error }, { status: 400 });
    }
    const notes = body.notes === undefined ? undefined : optionalText(body.notes, 4000, "Notes");
    if (notes && "error" in notes) {
      return NextResponse.json({ error: notes.error }, { status: 400 });
    }

    const startDate = body.startDate === undefined ? undefined : validDate(body.startDate);
    const targetDate = body.targetDate === undefined
      ? undefined
      : body.targetDate === null || body.targetDate === ""
        ? null
        : validDate(body.targetDate);

    if ((body.startDate !== undefined && !startDate) ||
      (body.targetDate !== undefined && targetDate === undefined)) {
      return NextResponse.json({ error: "Enter valid start and target dates." }, { status: 400 });
    }

    if (body.status !== undefined &&
      !Object.values(StaffDevelopmentPlanStatus).includes(body.status as StaffDevelopmentPlanStatus)) {
      return NextResponse.json({ error: "Choose a valid plan status." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffDevelopmentPlan.findFirst({
        where: { id: planId, schoolId },
        include: { goals: { select: { progress: true } } },
      });
      if (!existing) return { error: "Development plan not found.", status: 404 as const };

      if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
        return { error: "Completed or cancelled plans cannot be changed.", status: 409 as const };
      }

      const nextStatus = (body.status as StaffDevelopmentPlanStatus | undefined) ?? existing.status;
      const allowedTransition =
        nextStatus === existing.status ||
        (existing.status === "DRAFT" && (nextStatus === "ACTIVE" || nextStatus === "CANCELLED")) ||
        (existing.status === "ACTIVE" && (nextStatus === "COMPLETED" || nextStatus === "CANCELLED"));

      if (!allowedTransition) {
        return { error: "That plan status transition is not allowed.", status: 409 as const };
      }

      const nextStart = startDate ?? existing.startDate;
      const nextTarget = targetDate === undefined ? existing.targetDate : targetDate;
      if (nextTarget && nextTarget < nextStart) {
        return { error: "Target date cannot precede the start date.", status: 400 as const };
      }

      if (nextStatus === "COMPLETED" &&
        (existing.goals.length === 0 || existing.goals.some((goal) => goal.progress !== 100))) {
        return { error: "Add at least one goal and complete every goal before completing this plan.", status: 409 as const };
      }

      const plan = await tx.staffDevelopmentPlan.update({
        where: { id: existing.id },
        data: {
          ...(body.title !== undefined ? { title: (body.title as string).trim() } : {}),
          ...(description !== undefined ? { description: description.value } : {}),
          ...(startDate ? { startDate } : {}),
          ...(targetDate !== undefined ? { targetDate } : {}),
          ...(notes !== undefined ? { notes: notes.value } : {}),
          ...(body.status !== undefined ? { status: nextStatus } : {}),
          ...(body.status !== undefined ? { completedAt: nextStatus === "COMPLETED" ? new Date() : null } : {}),
        },
        include: {
          staffProfile: {
            select: {
              id: true, employeeNumber: true, firstName: true, middleName: true,
              lastName: true, jobTitle: true, department: true, status: true,
            },
          },
          goals: true,
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_DEVELOPMENT_PLAN_UPDATED",
        resourceType: "StaffDevelopmentPlan",
        resourceId: plan.id,
        metadata: {
          previousStatus: existing.status,
          status: plan.status,
          changedFields: Object.keys(body),
        },
      }, request);

      return { plan };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ plan: result.plan });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "A concurrent development-plan change conflicted with this update. Refresh and try again." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
