-- CreateEnum
CREATE TYPE "StaffPerformanceGoalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StaffPerformanceGoalPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "StaffPerformanceGoal" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "targetValue" DECIMAL(12,2) NOT NULL,
    "baselineValue" DECIMAL(12,2),
    "currentValue" DECIMAL(12,2),
    "unit" TEXT,
    "successCriteria" TEXT,
    "priority" "StaffPerformanceGoalPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "StaffPerformanceGoalStatus" NOT NULL DEFAULT 'DRAFT',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPerformanceGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPerformanceGoalProgress" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "currentValue" DECIMAL(12,2),
    "note" TEXT,
    "evidence" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPerformanceGoalProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffPerformanceGoal_schoolId_status_dueDate_idx" ON "StaffPerformanceGoal"("schoolId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "StaffPerformanceGoal_schoolId_staffProfileId_status_idx" ON "StaffPerformanceGoal"("schoolId", "staffProfileId", "status");

-- CreateIndex
CREATE INDEX "StaffPerformanceGoal_createdById_idx" ON "StaffPerformanceGoal"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPerformanceGoal_id_schoolId_key" ON "StaffPerformanceGoal"("id", "schoolId");

-- CreateIndex
CREATE INDEX "StaffPerformanceGoalProgress_schoolId_goalId_createdAt_idx" ON "StaffPerformanceGoalProgress"("schoolId", "goalId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffPerformanceGoalProgress_recordedById_idx" ON "StaffPerformanceGoalProgress"("recordedById");

-- AddForeignKey
ALTER TABLE "StaffPerformanceGoal" ADD CONSTRAINT "StaffPerformanceGoal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceGoal" ADD CONSTRAINT "StaffPerformanceGoal_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceGoal" ADD CONSTRAINT "StaffPerformanceGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceGoalProgress" ADD CONSTRAINT "StaffPerformanceGoalProgress_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceGoalProgress" ADD CONSTRAINT "StaffPerformanceGoalProgress_goalId_schoolId_fkey" FOREIGN KEY ("goalId", "schoolId") REFERENCES "StaffPerformanceGoal"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceGoalProgress" ADD CONSTRAINT "StaffPerformanceGoalProgress_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
