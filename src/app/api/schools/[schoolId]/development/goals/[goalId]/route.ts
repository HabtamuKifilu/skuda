import { NextRequest, NextResponse } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const MANAGERS = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

type Context = { params: Promise<{ schoolId: string; goalId: string }> };

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
  console.error("Staff development goal update error:", error);
  return NextResponse.json({ error: "Unable to update the development goal." }, { status: 500 });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, goalId } = await context.params;
    let authorization;
    let isManager = false;

    try {
      authorization = await requireSchoolRole(request.headers, schoolId, [...MANAGERS]);
      isManager = true;
    } catch (error) {
      const response = authorizationErrorResponse(error);
      if (!response) throw error;

      // Non-managers may update progress and notes only on their own goals.
      authorization = await requireSchoolRole(request.headers, schoolId, []);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!isRecord(body)) {
      return NextResponse.json({ error: "A goal update is required." }, { status: 400 });
    }

    const allowed = isManager
      ? ["title", "description", "successCriteria", "dueDate", "trainingRecordId", "notes", "progress"]
      : ["progress", "notes"];

    if (Object.keys(body).length === 0 || Object.keys(body).some((key) => !allowed.includes(key))) {
      return NextResponse.json({ error: "The request is empty or contains unsupported fields." }, { status: 400 });
    }

    if (!isManager && body.progress === undefined) {
      return NextResponse.json({ error: "Progress is required for employee updates." }, { status: 400 });
    }

    if (body.title !== undefined &&
      (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 160)) {
      return NextResponse.json({ error: "Goal title is required and must be at most 160 characters." }, { status: 400 });
    }

    const description = body.description === undefined ? undefined : optionalText(body.description, 4000, "Description");
    if (description && "error" in description) return NextResponse.json({ error: description.error }, { status: 400 });

    const successCriteria = body.successCriteria === undefined
      ? undefined
      : optionalText(body.successCriteria, 2000, "Success criteria");
    if (successCriteria && "error" in successCriteria) {
      return NextResponse.json({ error: successCriteria.error }, { status: 400 });
    }

    const notes = body.notes === undefined ? undefined : optionalText(body.notes, 4000, "Notes");
    if (notes && "error" in notes) return NextResponse.json({ error: notes.error }, { status: 400 });

    const dueDate = body.dueDate === undefined
      ? undefined
      : body.dueDate === null || body.dueDate === ""
        ? null
        : validDate(body.dueDate);

    if (body.dueDate !== undefined && dueDate === undefined) {
      return NextResponse.json({ error: "Enter a valid goal due date." }, { status: 400 });
    }

    if (body.trainingRecordId !== undefined && body.trainingRecordId !== null &&
      (typeof body.trainingRecordId !== "string" || !body.trainingRecordId.trim())) {
      return NextResponse.json({ error: "Training record selection is invalid." }, { status: 400 });
    }

    if (body.progress !== undefined &&
      (!Number.isInteger(body.progress) || (body.progress as number) < 0 || (body.progress as number) > 100)) {
      return NextResponse.json({ error: "Progress must be a whole number from 0 to 100." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffDevelopmentGoal.findFirst({
        where: { id: goalId, schoolId },
        include: {
          plan: { select: { id: true, status: true, startDate: true } },
        },
      });

      if (!existing) return { error: "Development goal not found.", status: 404 as const };

      if (!isManager) {
        const profile = await tx.staffProfile.findFirst({
          where: { id: existing.staffProfileId, schoolId, userId: authorization.userId },
          select: { id: true },
        });

        if (!profile) return { error: "Development goal not found.", status: 404 as const };
        if (existing.plan.status !== "ACTIVE") {
          return { error: "You can update progress only on goals in active development plans.", status: 409 as const };
        }
        if (body.notes !== undefined &&
          (typeof body.notes !== "string" && body.notes !== null)) {
          return { error: "Notes must be text.", status: 400 as const };
        }
        if (typeof body.notes === "string" && body.notes.length > 4000) {
          return { error: "Notes must be at most 4000 characters.", status: 400 as const };
        }
      }

      if (existing.plan.status !== "DRAFT" && existing.plan.status !== "ACTIVE") {
        return { error: "Goals in completed or cancelled plans cannot be changed.", status: 409 as const };
      }

      const nextDueDate = dueDate === undefined ? existing.dueDate : dueDate;
      if (nextDueDate && nextDueDate < existing.plan.startDate) {
        return { error: "Goal due date cannot precede the plan start date.", status: 400 as const };
      }

      let trainingRecordId: string | null | undefined;
      if (body.trainingRecordId === undefined) {
        trainingRecordId = undefined;
      } else if (body.trainingRecordId === null || body.trainingRecordId === "") {
        trainingRecordId = null;
      } else {
        const training = await tx.staffTrainingRecord.findFirst({
          where: {
            id: (body.trainingRecordId as string).trim(),
            schoolId,
            staffProfileId: existing.staffProfileId,
          },
          select: { id: true },
        });

        if (!training) {
          return {
            error: "The selected training record does not belong to this employee and school.",
            status: 400 as const,
          };
        }
        trainingRecordId = training.id;
      }

      const progress = body.progress as number | undefined;
      const goal = await tx.staffDevelopmentGoal.update({
        where: { id: existing.id },
        data: {
          ...(body.title !== undefined ? { title: (body.title as string).trim() } : {}),
          ...(description !== undefined ? { description: description.value } : {}),
          ...(successCriteria !== undefined ? { successCriteria: successCriteria.value } : {}),
          ...(notes !== undefined ? { notes: notes.value } : {}),
          ...(dueDate !== undefined ? { dueDate } : {}),
          ...(trainingRecordId !== undefined ? { trainingRecordId } : {}),
          ...(progress !== undefined
            ? { progress, completedAt: progress === 100 ? (existing.progress === 100 ? existing.completedAt ?? new Date() : new Date()) : null }
            : {}),
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_DEVELOPMENT_GOAL_UPDATED",
        resourceType: "StaffDevelopmentGoal",
        resourceId: goal.id,
        metadata: {
          planId: existing.plan.id,
          changedFields: Object.keys(body),
          previousProgress: existing.progress,
          progress: goal.progress,
        },
      }, request);

      return { goal };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ goal: result.goal });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "A concurrent development-goal change conflicted with this update. Refresh and try again." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
