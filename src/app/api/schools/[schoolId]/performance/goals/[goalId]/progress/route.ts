import { NextRequest, NextResponse } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
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
  console.error("Performance goal progress API error:", error);
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

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId, goalId } = await context.params;
    const authorization = await requireSchoolMembership(request.headers, schoolId);
    const isManager = authorization.roles.some((role) =>
      MANAGERS.includes(role as (typeof MANAGERS)[number]),
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
    }
    if (!isRecord(body)) {
      return NextResponse.json({ error: "The request body must be an object." }, { status: 400 });
    }

    if (
      typeof body.progress !== "number" ||
      !Number.isInteger(body.progress) ||
      body.progress < 0 ||
      body.progress > 100
    ) {
      return NextResponse.json({ error: "Progress must be an integer from 0 to 100." }, { status: 400 });
    }

    for (const field of ["note", "evidence"] as const) {
      if (body[field] !== undefined && body[field] !== null && typeof body[field] !== "string") {
        return NextResponse.json({ error: `${field} must be text or null.` }, { status: 400 });
      }
      const maxLength = field === "note" ? 2000 : 5000;
      if (typeof body[field] === "string" && body[field].trim().length > maxLength) {
        return NextResponse.json({ error: `${field} exceeds its maximum length.` }, { status: 400 });
      }
    }

    const suppliedCurrentValue = "currentValue" in body;
    const currentValue = suppliedCurrentValue ? parseDecimal(body.currentValue) : undefined;
    if (suppliedCurrentValue && currentValue === undefined) {
      return NextResponse.json({ error: "Current value must be a non-negative number with at most two decimal places, or null." }, { status: 400 });
    }

    const goal = await prisma.staffPerformanceGoal.findFirst({
      where: { id: goalId, schoolId },
      select: {
        id: true,
        status: true,
        progress: true,
        currentValue: true,
        staffProfile: { select: { userId: true } },
      },
    });

    if (!goal) {
      return NextResponse.json({ error: "Performance goal not found." }, { status: 404 });
    }

    if (!isManager && goal.staffProfile.userId !== authorization.userId) {
      return NextResponse.json({ error: "You are not authorized to update this goal." }, { status: 403 });
    }

    if (goal.status === "COMPLETED" || goal.status === "CANCELLED") {
      return NextResponse.json({ error: "Progress cannot be recorded for a completed or cancelled goal." }, { status: 409 });
    }

    const nextCurrentValue = suppliedCurrentValue ? currentValue : (goal.currentValue === null ? null : Number(goal.currentValue));
    const note = typeof body.note === "string" ? body.note.trim() || null : null;
    const evidence = typeof body.evidence === "string" ? body.evidence.trim() || null : null;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.staffPerformanceGoal.update({
        where: { id_schoolId: { id: goalId, schoolId } },
        data: {
          progress: body.progress as number,
          currentValue: nextCurrentValue,
        },
      });

      const progressUpdate = await tx.staffPerformanceGoalProgress.create({
        data: {
          schoolId,
          goalId,
          progress: body.progress as number,
          currentValue: nextCurrentValue,
          note,
          evidence,
          recordedById: authorization.userId,
        },
        include: {
          recordedBy: { select: { id: true, name: true } },
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_PERFORMANCE_GOAL_PROGRESS_RECORDED",
        resourceType: "StaffPerformanceGoal",
        resourceId: goalId,
        metadata: {
          previousProgress: goal.progress,
          progress: updated.progress,
          currentValue: nextCurrentValue === null ? null : String(nextCurrentValue),
          hasEvidence: Boolean(evidence),
        },
      }, request);

      return { goal: updated, progressUpdate };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
