-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateTable
CREATE TABLE "StaffOnboarding" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "targetCompletionDate" TIMESTAMP(3),
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffOnboardingTask" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffOnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffOnboarding_staffProfileId_key" ON "StaffOnboarding"("staffProfileId");

-- CreateIndex
CREATE INDEX "StaffOnboarding_schoolId_completedAt_idx" ON "StaffOnboarding"("schoolId", "completedAt");

-- CreateIndex
CREATE INDEX "StaffOnboarding_schoolId_startDate_idx" ON "StaffOnboarding"("schoolId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffOnboarding_id_schoolId_key" ON "StaffOnboarding"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffOnboarding_staffProfileId_schoolId_key" ON "StaffOnboarding"("staffProfileId", "schoolId");

-- CreateIndex
CREATE INDEX "StaffOnboardingTask_schoolId_status_idx" ON "StaffOnboardingTask"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StaffOnboardingTask_onboardingId_sortOrder_idx" ON "StaffOnboardingTask"("onboardingId", "sortOrder");

-- AddForeignKey
ALTER TABLE "StaffOnboarding" ADD CONSTRAINT "StaffOnboarding_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOnboarding" ADD CONSTRAINT "StaffOnboarding_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOnboardingTask" ADD CONSTRAINT "StaffOnboardingTask_onboardingId_schoolId_fkey" FOREIGN KEY ("onboardingId", "schoolId") REFERENCES "StaffOnboarding"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
