import { AppNotificationType, PerformanceReviewCycleStatus, StaffPerformanceReviewStatus } from "@/generated/prisma/enums";
import { createInAppNotification } from "@/lib/notifications";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const secret = process.env.NOTIFICATION_WORKER_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);

  try {
    const todaysNotifications = await prisma.appNotification.findMany({
      where: {
        dedupeKey: {
          startsWith: "performance-review:",
          endsWith: `:${dayKey}`,
        },
        type: {
          in: [
            AppNotificationType.PERFORMANCE_REVIEW_REMINDER,
            AppNotificationType.PERFORMANCE_REVIEW_OVERDUE,
          ],
        },
      },
      select: { dedupeKey: true },
    });

    const alreadyNotifiedReviewIds = [
      ...new Set(
        todaysNotifications
          .map(({ dedupeKey }) =>
            dedupeKey?.match(/^performance-review:(.+):(reminder|overdue):\d{4}-\d{2}-\d{2}$/)?.[1],
          )
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const reviews = await prisma.staffPerformanceReview.findMany({
      where: {
        id: { notIn: alreadyNotifiedReviewIds },
        status: {
          in: [
            StaffPerformanceReviewStatus.DRAFT,
            StaffPerformanceReviewStatus.IN_PROGRESS,
          ],
        },
        cycle: {
          status: PerformanceReviewCycleStatus.OPEN,
        },
      },
      select: {
        id: true,
        schoolId: true,
        reviewerId: true,
        cycle: {
          select: {
            id: true,
            name: true,
            endDate: true,
          },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: 500,
    });

    let reminders = 0;
    let overdue = 0;

    await prisma.$transaction(async (tx) => {
      for (const review of reviews) {
        const isOverdue = review.cycle.endDate < now;
        const type = isOverdue
          ? AppNotificationType.PERFORMANCE_REVIEW_OVERDUE
          : AppNotificationType.PERFORMANCE_REVIEW_REMINDER;

        await createInAppNotification(tx, {
          schoolId: review.schoolId,
          recipientUserId: review.reviewerId,
          type,
          title: isOverdue
            ? "Performance review overdue"
            : "Performance review reminder",
          message: isOverdue
            ? `Your review for ${review.cycle.name} is past its cycle deadline. Please complete it.`
            : `Your review for ${review.cycle.name} is still outstanding. Please complete it before the cycle deadline.`,
          href: "/hr/performance",
          dedupeKey: `performance-review:${review.id}:${isOverdue ? "overdue" : "reminder"}:${dayKey}`,
        });

        if (isOverdue) overdue++;
        else reminders++;
      }
    });

    return Response.json({
      processed: reviews.length,
      reminders,
      overdue,
      date: dayKey,
      note: "At most 500 reviews without a reminder notification for this day are processed per run.",
    });
  } catch (error) {
    console.error("Notification processing failed:", error);
    return Response.json(
      { error: "Unable to process performance review notifications." },
      { status: 500 },
    );
  }
}
