import { NextRequest } from "next/server";
import { StaffPerformanceReviewStatus } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolMembership } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";
import { createInAppNotification } from "@/lib/notifications";

type Context = {
  params: Promise<{ schoolId: string; reviewId: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId, reviewId } = await context.params;
    const authorization = await requireSchoolMembership(request.headers, schoolId);

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // An empty request body is allowed.
    }

    if (!isRecord(body)) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (Object.keys(body).some((key) => key !== "employeeComments")) {
      return Response.json(
        { error: "The request contains unsupported fields." },
        { status: 400 },
      );
    }

    let employeeComments: string | null | undefined;
    if (body.employeeComments !== undefined) {
      if (
        body.employeeComments !== null &&
        (typeof body.employeeComments !== "string" ||
          body.employeeComments.trim().length > 4000)
      ) {
        return Response.json(
          { error: "Employee comments must be text of at most 4000 characters, or null." },
          { status: 400 },
        );
      }

      employeeComments =
        typeof body.employeeComments === "string"
          ? body.employeeComments.trim() || null
          : null;
    }

    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.staffPerformanceReview.findFirst({
        where: { id: reviewId, schoolId },
        select: {
          id: true,
          status: true,
          employeeComments: true,
          reviewerId: true,
          cycle: { select: { name: true } },
          staffProfile: { select: { userId: true, firstName: true, lastName: true } },
        },
      });

      if (!review) {
        return {
          error: "Performance review not found in this school.",
          statusCode: 404 as const,
        };
      }

      if (review.staffProfile.userId !== authorization.userId) {
        return {
          error: "Only the employee assigned to this review can acknowledge it.",
          statusCode: 403 as const,
        };
      }

      if (review.status !== StaffPerformanceReviewStatus.SUBMITTED) {
        return {
          error: "Only a submitted review can be acknowledged.",
          statusCode: 409 as const,
        };
      }

      const updated = await tx.staffPerformanceReview.update({
        where: { id: review.id },
        data: {
          status: StaffPerformanceReviewStatus.ACKNOWLEDGED,
          acknowledgedAt: new Date(),
          ...(employeeComments !== undefined ? { employeeComments } : {}),
        },
        select: {
          id: true,
          status: true,
          acknowledgedAt: true,
          employeeComments: true,
        },
      });

      await createInAppNotification(tx, {
        schoolId,
        recipientUserId: review.reviewerId,
        type: "PERFORMANCE_REVIEW_ACKNOWLEDGED",
        title: "Performance review acknowledged",
        message: `${review.staffProfile.firstName} ${review.staffProfile.lastName} acknowledged the review for ${review.cycle.name}.`,
        href: `/hr/performance`,
        dedupeKey: `performance-review:${review.id}:acknowledged`,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_PERFORMANCE_REVIEW_ACKNOWLEDGED",
          resourceType: "StaffPerformanceReview",
          resourceId: review.id,
          metadata: {
            previousStatus: review.status,
            newStatus: updated.status,
            employeeCommentsProvided: employeeComments !== undefined,
          },
        },
        request,
      );

      return { review: updated };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.statusCode });
    }

    return Response.json({ review: result.review });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to acknowledge performance review:", error);
    return Response.json(
      { error: "Unable to acknowledge the performance review." },
      { status: 500 },
    );
  }
}
