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
  console.error("Staff development goal creation error:", error);
  return NextResponse.json({ error: "Unable to create the development goal." }, { status: 500 });
}

export async function POST(request: NextRequest, context: Context) {
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
      return NextResponse.json({ error: "A development goal is required." }, { status: 400 });
    }

    const allowed = ["title", "description", "successCriteria", "dueDate", "trainingRecordId", "notes"];
    if (Object.keys(body).some((key) => !allowed.includes(key))) {
      return NextResponse.json({ error: "The request contains unsupported fields." }, { status: 400 });
    }

    if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 160) {
      return NextResponse.json({ error: "Goal title is required and must be at most 160 characters." }, { status: 400 });
    }

    const description = optionalText(body.description, 4000, "Description");
    if ("error" in description) return NextResponse.json({ error: description.error }, { status: 400 });

    const successCriteria = optionalText(body.successCriteria, 2000, "Success criteria");
    if ("error" in successCriteria) return NextResponse.json({ error: successCriteria.error }, { status: 400 });

    const notes = optionalText(body.notes, 4000, "Notes");
    if ("error" in notes) return NextResponse.json({ error: notes.error }, { status: 400 });

    const dueDate = body.dueDate === undefined || body.dueDate === null || body.dueDate === ""
      ? null
      : validDate(body.dueDate);

    if (body.dueDate && !dueDate) {
      return NextResponse.json({ error: "Enter a valid goal due date." }, { status: 400 });
    }

    if (body.trainingRecordId !== undefined && body.trainingRecordId !== null &&
      (typeof body.trainingRecordId !== "string" || !body.trainingRecordId.trim())) {
      return NextResponse.json({ error: "Training record selection is invalid." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.staffDevelopmentPlan.findFirst({
        where: { id: planId, schoolId },
        select: { id: true, status: true, startDate: true, staffProfileId: true },
      });

      if (!plan) return { error: "Development plan not found.", status: 404 as const };

      if (plan.status !== "DRAFT" && plan.status !== "ACTIVE") {
        return { error: "Goals can only be added to draft or active plans.", status: 409 as const };
      }

      if (dueDate && dueDate < plan.startDate) {
        return { error: "Goal due date cannot precede the plan start date.", status: 400 as const };
      }

      let trainingRecordId: string | null = null;
      if (typeof body.trainingRecordId === "string" && body.trainingRecordId.trim()) {
        const training = await tx.staffTrainingRecord.findFirst({
          where: {
            id: body.trainingRecordId.trim(),
            schoolId,
            staffProfileId: plan.staffProfileId,
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

      const goal = await tx.staffDevelopmentGoal.create({
        data: {
          schoolId,
          planId: plan.id,
          staffProfileId: plan.staffProfileId,
          title: (body.title as string).trim(),
          description: description.value,
          successCriteria: successCriteria.value,
          dueDate,
          trainingRecordId,
          notes: notes.value,
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_DEVELOPMENT_GOAL_CREATED",
        resourceType: "StaffDevelopmentGoal",
        resourceId: goal.id,
        metadata: { planId: plan.id, staffProfileId: plan.staffProfileId, title: goal.title },
      }, request);

      return { goal };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ goal: result.goal }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
