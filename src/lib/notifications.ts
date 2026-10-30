import type { Prisma } from "@/generated/prisma/client";

type NotificationDb = Prisma.TransactionClient;

type InAppNotificationInput = {
  schoolId: string;
  recipientUserId: string;
  type:
    | "PERFORMANCE_REVIEW_SUBMITTED"
    | "PERFORMANCE_REVIEW_ACKNOWLEDGED"
    | "PERFORMANCE_REVIEW_REMINDER"
    | "PERFORMANCE_REVIEW_OVERDUE";
  title: string;
  message: string;
  href?: string;
  dedupeKey: string;
};

export async function createInAppNotification(
  db: NotificationDb,
  input: InAppNotificationInput,
) {
  return db.appNotification.upsert({
    where: {
      schoolId_recipientUserId_dedupeKey: {
        schoolId: input.schoolId,
        recipientUserId: input.recipientUserId,
        dedupeKey: input.dedupeKey,
      },
    },
    create: {
      schoolId: input.schoolId,
      recipientUserId: input.recipientUserId,
      type: input.type,
      title: input.title,
      message: input.message,
      href: input.href ?? null,
      dedupeKey: input.dedupeKey,
    },
    update: {},
  });
}
