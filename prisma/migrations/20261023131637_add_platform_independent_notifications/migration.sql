-- CreateEnum
CREATE TYPE "AppNotificationType" AS ENUM ('PERFORMANCE_REVIEW_SUBMITTED', 'PERFORMANCE_REVIEW_ACKNOWLEDGED', 'PERFORMANCE_REVIEW_REMINDER', 'PERFORMANCE_REVIEW_OVERDUE');

-- CreateTable
CREATE TABLE "AppNotification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" "AppNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppNotification_recipientUserId_readAt_createdAt_idx" ON "AppNotification"("recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotification_schoolId_recipientUserId_createdAt_idx" ON "AppNotification"("schoolId", "recipientUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppNotification_schoolId_recipientUserId_dedupeKey_key" ON "AppNotification"("schoolId", "recipientUserId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
