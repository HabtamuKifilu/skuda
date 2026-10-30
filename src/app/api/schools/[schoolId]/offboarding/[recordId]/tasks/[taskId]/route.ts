import { NextRequest, NextResponse } from "next/server";
import {
  SchoolMembershipRole,
  StaffOffboardingStatus,
  StaffOffboardingTaskStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{
    schoolId: string;
    recordId: string;
    taskId: string;
  }>;
};

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const closedRecordStatuses: StaffOffboardingStatus[] = [
  StaffOffboardingStatus.REJECTED,
  StaffOffboardingStatus.WITHDRAWN,
  StaffOffboardingStatus.COMPLETED,
];

const taskStatuses = Object.values(StaffOffboardingTaskStatus);

function parseText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    return undefined;
  }
  return value.trim() || null;
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, recordId, taskId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...roles],
    );

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    if (
      Object.prototype.hasOwnProperty.call(data, "reviewNotes") &&
      !authorization.roles.some(
        (role) =>
          role === SchoolMembershipRole.OWNER ||
          role === SchoolMembershipRole.ADMIN,
      )
    ) {
      return NextResponse.json(
        { error: "Only school owners and administrators can review clearance tasks." },
        { status: 403 },
      );
    }

    const allowed = [
      "title",
      "description",
      "required",
      "status",
      "assignedToId",
      "dueDate",
      "evidenceRef",
      "reviewNotes",
      "exceptionReason",
    ];

    if (
      Object.keys(data).length === 0 ||
      Object.keys(data).some((key) => !allowed.includes(key))
    ) {
      return NextResponse.json(
        { error: "Request is empty or contains unsupported fields." },
        { status: 400 },
      );
    }

    const title =
      data.title === undefined
        ? undefined
        : typeof data.title === "string" &&
            data.title.trim().length > 0 &&
            data.title.trim().length <= 200
          ? data.title.trim()
          : null;

    const description = parseText(data.description, 4000);
    const assignedToId = parseText(data.assignedToId, 200);
    const evidenceRef = parseText(data.evidenceRef, 1000);
    const reviewNotes = parseText(data.reviewNotes, 2000);
    const exceptionReason = parseText(data.exceptionReason, 2000);
    const dueDate = parseDate(data.dueDate);

    if (
      title === null ||
      description === undefined && data.description !== undefined ||
      assignedToId === undefined ||
      evidenceRef === undefined ||
      reviewNotes === undefined ||
      exceptionReason === undefined ||
      dueDate === undefined ||
      (data.required !== undefined && typeof data.required !== "boolean") ||
      (data.status !== undefined &&
        (typeof data.status !== "string" ||
          !taskStatuses.includes(
            data.status as StaffOffboardingTaskStatus,
          )))
    ) {
      return NextResponse.json(
        { error: "One or more task fields are invalid." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffOffboardingTask.findFirst({
        where: {
          id: taskId,
          schoolId,
          offboardingId: recordId,
        },
        include: {
          offboarding: {
            select: { status: true },
          },
        },
      });

      if (!existing) {
        return {
          error: "Task not found for this offboarding record.",
          status: 404 as const,
        };
      }

      if (closedRecordStatuses.includes(existing.offboarding.status)) {
        return {
          error: "Tasks cannot be changed on a closed offboarding record.",
          status: 409 as const,
        };
      }

      const nextStatus =
        data.status === undefined
          ? existing.status
          : data.status as StaffOffboardingTaskStatus;

      if (
        nextStatus === StaffOffboardingTaskStatus.BLOCKED &&
        !((exceptionReason ?? existing.exceptionReason)?.trim())
      ) {
        return {
          error: "A reason is required when a task is blocked.",
          status: 400 as const,
        };
      }

      if (
        nextStatus === StaffOffboardingTaskStatus.WAIVED &&
        !((exceptionReason ?? existing.exceptionReason)?.trim())
      ) {
        return {
          error: "A documented exception reason is required to waive a task.",
          status: 400 as const,
        };
      }

      if (
        nextStatus === StaffOffboardingTaskStatus.COMPLETED &&
        !((evidenceRef ?? existing.evidenceRef)?.trim())
      ) {
        return {
          error: "Evidence is required before a task can be completed.",
          status: 400 as const,
        };
      }

      if (data.status !== undefined && nextStatus !== existing.status) {
        const allowedTransitions: Record<
          StaffOffboardingTaskStatus,
          StaffOffboardingTaskStatus[]
        > = {
          PENDING: [
            StaffOffboardingTaskStatus.IN_PROGRESS,
            StaffOffboardingTaskStatus.COMPLETED,
            StaffOffboardingTaskStatus.BLOCKED,
            StaffOffboardingTaskStatus.WAIVED,
          ],
          IN_PROGRESS: [
            StaffOffboardingTaskStatus.PENDING,
            StaffOffboardingTaskStatus.COMPLETED,
            StaffOffboardingTaskStatus.BLOCKED,
            StaffOffboardingTaskStatus.WAIVED,
          ],
          BLOCKED: [
            StaffOffboardingTaskStatus.PENDING,
            StaffOffboardingTaskStatus.IN_PROGRESS,
            StaffOffboardingTaskStatus.COMPLETED,
            StaffOffboardingTaskStatus.WAIVED,
          ],
          COMPLETED: [
            StaffOffboardingTaskStatus.IN_PROGRESS,
            StaffOffboardingTaskStatus.BLOCKED,
          ],
          WAIVED: [
            StaffOffboardingTaskStatus.PENDING,
            StaffOffboardingTaskStatus.IN_PROGRESS,
          ],
        };

        if (!allowedTransitions[existing.status].includes(nextStatus)) {
          return {
            error: `Transition from ${existing.status} to ${nextStatus} is not allowed.`,
            status: 409 as const,
          };
        }
      }

      if (assignedToId) {
        const membership = await tx.schoolMembership.findFirst({
          where: { schoolId, userId: assignedToId, isActive: true },
          select: { id: true },
        });

        if (!membership) {
          return {
            error: "The assigned user must have an active membership in this school.",
            status: 400 as const,
          };
        }
      }

      const now = new Date();
      const completing =
        data.status !== undefined &&
        nextStatus === StaffOffboardingTaskStatus.COMPLETED &&
        existing.status !== StaffOffboardingTaskStatus.COMPLETED;

      const reopening =
        data.status !== undefined &&
        nextStatus !== StaffOffboardingTaskStatus.COMPLETED &&
        existing.status === StaffOffboardingTaskStatus.COMPLETED;

      const reviewing = data.reviewNotes !== undefined;

      const updateData = {
        ...(title !== undefined ? { title } : {}),
        ...(data.description !== undefined ? { description } : {}),
        ...(data.required !== undefined ? { required: data.required as boolean } : {}),
        ...(data.assignedToId !== undefined ? { assignedToId } : {}),
        ...(data.dueDate !== undefined ? { dueDate } : {}),
        ...(data.evidenceRef !== undefined ? { evidenceRef } : {}),
        ...(data.exceptionReason !== undefined ? { exceptionReason } : {}),
        ...(data.status !== undefined ? { status: nextStatus } : {}),
        ...(completing
          ? { completedAt: now, completedById: authorization.userId }
          : {}),
        ...(reopening
          ? { completedAt: null, completedById: null }
          : {}),
        ...(reviewing
          ? {
              reviewerId: authorization.userId,
              reviewedAt: now,
              reviewNotes,
            }
          : {}),
      };

      const updatedCount = await tx.staffOffboardingTask.updateMany({
        where: {
          id: taskId,
          schoolId,
          offboardingId: recordId,
          status: existing.status,
          updatedAt: existing.updatedAt,
        },
        data: updateData,
      });

      if (updatedCount.count !== 1) {
        return {
          error: "This task changed concurrently. Refresh and try again.",
          status: 409 as const,
        };
      }

      const task = await tx.staffOffboardingTask.findFirstOrThrow({
        where: { id: taskId, schoolId, offboardingId: recordId },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_OFFBOARDING_TASK_UPDATED",
          resourceType: "StaffOffboardingTask",
          resourceId: task.id,
          metadata: {
            offboardingId: recordId,
            previousStatus: existing.status,
            status: task.status,
            completedById: task.completedById,
            completedAt: task.completedAt?.toISOString() ?? null,
            reviewerId: task.reviewerId,
            reviewedAt: task.reviewedAt?.toISOString() ?? null,
            changedFields: Object.keys(data),
          },
        },
        request,
      );

      return { task };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ task: result.task });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "A concurrent task update conflicted with this request. Refresh and try again." },
        { status: 409 },
      );
    }

    return authorizationErrorResponse(error) ??
      NextResponse.json(
        { error: "Unable to update the offboarding task." },
        { status: 500 },
      );
  }
}
