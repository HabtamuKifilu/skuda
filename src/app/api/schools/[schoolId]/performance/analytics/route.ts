import { NextRequest, NextResponse } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const MANAGERS = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

type Context = { params: Promise<{ schoolId: string }> };

function errorResponse(error: unknown): Response {
  const response = authorizationErrorResponse(error);
  if (response) return response;

  console.error("Performance analytics API error:", error);
  return Response.json(
    { error: "Unable to load performance analytics." },
    { status: 500 },
  );
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...MANAGERS]);

    const [cycles, goals] = await Promise.all([
      prisma.performanceReviewCycle.findMany({
        where: { schoolId },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
          reviews: {
            where: { schoolId },
            select: {
              id: true,
              status: true,
              overallRating: true,
              competencies: {
                where: { schoolId },
                select: { competency: true, rating: true },
              },
            },
          },
        },
      }),
      prisma.staffPerformanceGoal.findMany({
        where: { schoolId },
        select: { status: true, progress: true },
      }),
    ]);

    const cycleStatus = { DRAFT: 0, OPEN: 0, CLOSED: 0 };
    const reviewStatus = {
      DRAFT: 0,
      IN_PROGRESS: 0,
      SUBMITTED: 0,
      ACKNOWLEDGED: 0,
    };
    const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: 0,
    }));

    let reviewCount = 0;
    let finalizedCount = 0;
    let ratingTotal = 0;
    let ratingCount = 0;

    const competencyTotals = new Map<
      string,
      { total: number; count: number }
    >();

    const cycleTrend = cycles.map((cycle) => {
      cycleStatus[cycle.status] += 1;

      let cycleFinalized = 0;
      let cycleRatingTotal = 0;
      let cycleRatingCount = 0;

      for (const review of cycle.reviews) {
        reviewCount += 1;
        reviewStatus[review.status] += 1;

        const finalized =
          review.status === "SUBMITTED" ||
          review.status === "ACKNOWLEDGED";

        if (!finalized) continue;
        finalizedCount += 1;
        cycleFinalized += 1;

        if (
          review.overallRating !== null &&
          Number.isInteger(review.overallRating) &&
          review.overallRating >= 1 &&
          review.overallRating <= 5
        ) {
          const bucket = ratingDistribution.find(
            (item) => item.rating === review.overallRating,
          );
          if (bucket) bucket.count += 1;

          ratingTotal += review.overallRating;
          ratingCount += 1;
          cycleRatingTotal += review.overallRating;
          cycleRatingCount += 1;
        }

        for (const competency of review.competencies) {
          const current = competencyTotals.get(competency.competency) ?? {
            total: 0,
            count: 0,
          };
          current.total += competency.rating;
          current.count += 1;
          competencyTotals.set(competency.competency, current);
        }
      }

      return {
        id: cycle.id,
        name: cycle.name,
        startDate: cycle.startDate.toISOString(),
        endDate: cycle.endDate.toISOString(),
        status: cycle.status,
        totalReviews: cycle.reviews.length,
        finalizedReviews: cycleFinalized,
        completionRate:
          cycle.reviews.length === 0
            ? 0
            : Math.round((cycleFinalized / cycle.reviews.length) * 100),
        averageRating:
          cycleRatingCount === 0
            ? null
            : Number((cycleRatingTotal / cycleRatingCount).toFixed(2)),
      };
    });

    const goalStatus = {
      DRAFT: 0,
      ACTIVE: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    let goalProgressTotal = 0;
    let goalProgressCount = 0;

    for (const goal of goals) {
      goalStatus[goal.status] += 1;

      if (goal.status !== "CANCELLED") {
        goalProgressTotal += goal.progress;
        goalProgressCount += 1;
      }
    }

    const competencies = [...competencyTotals.entries()]
      .map(([name, values]) => ({
        name,
        averageRating: Number((values.total / values.count).toFixed(2)),
        count: values.count,
      }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 15);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      cycles: {
        total: cycles.length,
        byStatus: cycleStatus,
      },
      reviews: {
        total: reviewCount,
        finalized: finalizedCount,
        outstanding: reviewCount - finalizedCount,
        completionRate:
          reviewCount === 0
            ? 0
            : Math.round((finalizedCount / reviewCount) * 100),
        byStatus: reviewStatus,
        averageRating:
          ratingCount === 0
            ? null
            : Number((ratingTotal / ratingCount).toFixed(2)),
        ratingCount,
        ratingDistribution,
      },
      goals: {
        total: goals.length,
        byStatus: goalStatus,
        completed: goalStatus.COMPLETED,
        averageProgress:
          goalProgressCount === 0
            ? null
            : Math.round(goalProgressTotal / goalProgressCount),
        completionRate:
          goals.length === 0
            ? 0
            : Math.round((goalStatus.COMPLETED / goals.length) * 100),
      },
      competencies,
      cycleTrend,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
