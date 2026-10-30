import { NextRequest } from "next/server";
import {
  PerformanceReviewCycleStatus,
  SchoolMembershipRole,
  StaffPerformanceReviewStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ schoolId: string; cycleId: string }>;
};

const MANAGERS = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, cycleId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...MANAGERS],
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
      Array.isArray(body) ||
      !("status" in body)
    ) {
      return Response.json(
        { error: "Provide a valid cycle status." },
        { status: 400 },
      );
    }

    const status = body.status;
    if (
      status !== PerformanceReviewCycleStatus.OPEN &&
      status !== PerformanceReviewCycleStatus.CLOSED
    ) {
      return Response.json(
        { error: "A cycle can only be opened or closed through this endpoint." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const cycle = await tx.performanceReviewCycle.findFirst({
        where: { id: cycleId, schoolId },
        select: { id: true, name: true, status: true },
      });

      if (!cycle) {
        return {
          error: "Performance review cycle not found in this school.",
          statusCode: 404 as const,
        };
      }

      if (cycle.status === status) {
        return {
          error: `This review cycle is already ${status.toLowerCase()}.`,
          statusCode: 409 as const,
        };
      }

      if (
        status === PerformanceReviewCycleStatus.OPEN &&
        cycle.status !== PerformanceReviewCycleStatus.DRAFT
      ) {
        return {
          error: "Only a draft review cycle can be opened.",
          statusCode: 409 as const,
        };
      }

      if (
        status === PerformanceReviewCycleStatus.CLOSED &&
        cycle.status !== PerformanceReviewCycleStatus.OPEN
      ) {
        return {
          error: "Only an open review cycle can be closed.",
          statusCode: 409 as const,
        };
      }

      if (status === PerformanceReviewCycleStatus.CLOSED) {
        const outstandingCount = await tx.staffPerformanceReview.count({
          where: {
            schoolId,
            cycleId: cycle.id,
            status: {
              in: [
                StaffPerformanceReviewStatus.DRAFT,
                StaffPerformanceReviewStatus.IN_PROGRESS,
              ],
            },
          },
        });

        if (outstandingCount > 0) {
          return {
            error: `Cannot close this cycle: ${outstandingCount} review(s) remain in draft or in progress. Complete or resolve them before closing.`,
            statusCode: 409 as const,
          };
        }
      }

      const updated = await tx.performanceReviewCycle.update({
        where: { id: cycle.id },
        data: { status },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          updatedAt: true,
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action:
            status === PerformanceReviewCycleStatus.OPEN
              ? "PERFORMANCE_REVIEW_CYCLE_OPENED"
              : "PERFORMANCE_REVIEW_CYCLE_CLOSED",
          resourceType: "PerformanceReviewCycle",
          resourceId: cycle.id,
          metadata: {
            name: cycle.name,
            previousStatus: cycle.status,
            newStatus: status,
          },
        },
        request,
      );

      return { cycle: updated };
    });

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.statusCode },
      );
    }

    return Response.json({ cycle: result.cycle });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to update performance review cycle:", error);
    return Response.json(
      { error: "Unable to update the performance review cycle." },
      { status: 500 },
    );
  }
}
