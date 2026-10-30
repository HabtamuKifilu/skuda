import { NextRequest } from "next/server";
import {
  OnboardingTaskStatus,
  SchoolMembershipRole,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ schoolId: string; taskId: string }>;
};

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, taskId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...roles],
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return Response.json(
        { error: "A valid task status is required." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    if (
      Object.keys(data).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(data, "status") ||
      typeof data.status !== "string" ||
      !Object.values(OnboardingTaskStatus).includes(
        data.status as OnboardingTaskStatus,
      )
    ) {
      return Response.json(
        { error: "Status must be PENDING or COMPLETED." },
        { status: 400 },
      );
    }

    const status = data.status as OnboardingTaskStatus;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffOnboardingTask.findFirst({
        where: { id: taskId, schoolId },
        include: {
          onboarding: {
            select: { id: true, completedAt: true },
          },
        },
      });

      if (!existing) {
        return {
          error: "Onboarding task not found in this school.",
          statusCode: 404 as const,
        };
      }

      if (existing.onboarding.completedAt) {
        return {
          error: "Tasks in a completed onboarding plan cannot be changed.",
          statusCode: 409 as const,
        };
      }

      if (existing.status === status) {
        return { task: existing };
      }

      const task = await tx.staffOnboardingTask.update({
        where: { id: existing.id },
        data: {
          status,
          completedAt:
            status === OnboardingTaskStatus.COMPLETED
              ? new Date()
              : null,
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_ONBOARDING_TASK_STATUS_UPDATED",
          resourceType: "StaffOnboardingTask",
          resourceId: task.id,
          metadata: {
            onboardingId: existing.onboardingId,
            previousStatus: existing.status,
            newStatus: status,
          },
        },
        request,
      );

      return { task };
    });

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.statusCode },
      );
    }

    return Response.json({
      task: result.task,
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to update onboarding task:", error);
    return Response.json(
      { error: "Unable to update onboarding task." },
      { status: 500 },
    );
  }
}
