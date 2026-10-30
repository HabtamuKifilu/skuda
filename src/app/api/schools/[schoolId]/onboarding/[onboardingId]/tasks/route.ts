import { NextRequest } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ schoolId: string; onboardingId: string }>;
};

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId, onboardingId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...roles],
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "A valid task is required." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    if (
      Object.keys(data).some(
        (key) => !["title", "description", "dueDate"].includes(key),
      ) ||
      typeof data.title !== "string" ||
      !data.title.trim() ||
      data.title.trim().length > 160 ||
      (data.description !== undefined &&
        data.description !== null &&
        typeof data.description !== "string") ||
      (typeof data.description === "string" &&
        data.description.trim().length > 1000)
    ) {
      return Response.json(
        { error: "Enter a task title (up to 160 characters) and a description up to 1,000 characters." },
        { status: 400 },
      );
    }

    const title = data.title.trim();

    const dueDate = data.dueDate ? validDate(data.dueDate) : null;
    if (data.dueDate && !dueDate) {
      return Response.json({ error: "Enter a valid task due date." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.staffOnboarding.findFirst({
        where: { id: onboardingId, schoolId },
        select: { id: true, completedAt: true },
      });

      if (!plan) {
        return { error: "Onboarding plan not found in this school.", status: 404 as const };
      }
      if (plan.completedAt) {
        return { error: "Tasks cannot be added to a completed onboarding plan.", status: 409 as const };
      }

      const sortOrder = await tx.staffOnboardingTask.count({
        where: { schoolId, onboardingId },
      });

      const task = await tx.staffOnboardingTask.create({
        data: {
          schoolId,
          onboardingId,
          title,
          description:
            typeof data.description === "string"
              ? data.description.trim() || null
              : null,
          dueDate,
          sortOrder,
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_ONBOARDING_TASK_CREATED",
        resourceType: "StaffOnboardingTask",
        resourceId: task.id,
        metadata: { onboardingId, title },
      }, request);

      return { task };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ task: result.task }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to create onboarding task:", error);
    return Response.json({ error: "Unable to create onboarding task." }, { status: 500 });
  }
}
