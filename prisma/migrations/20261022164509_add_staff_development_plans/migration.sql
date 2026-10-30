-- CreateEnum
CREATE TYPE "StaffDevelopmentPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StaffDevelopmentPlan" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "targetDate" TIMESTAMP(3),
    "status" "StaffDevelopmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDevelopmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDevelopmentGoal" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "trainingRecordId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "successCriteria" TEXT,
    "dueDate" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDevelopmentGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffDevelopmentPlan_schoolId_status_targetDate_idx" ON "StaffDevelopmentPlan"("schoolId", "status", "targetDate");

-- CreateIndex
CREATE INDEX "StaffDevelopmentPlan_schoolId_staffProfileId_createdAt_idx" ON "StaffDevelopmentPlan"("schoolId", "staffProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffDevelopmentPlan_createdById_idx" ON "StaffDevelopmentPlan"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDevelopmentPlan_id_schoolId_key" ON "StaffDevelopmentPlan"("id", "schoolId");

-- CreateIndex
CREATE INDEX "StaffDevelopmentGoal_schoolId_planId_dueDate_idx" ON "StaffDevelopmentGoal"("schoolId", "planId", "dueDate");

-- CreateIndex
CREATE INDEX "StaffDevelopmentGoal_schoolId_staffProfileId_progress_idx" ON "StaffDevelopmentGoal"("schoolId", "staffProfileId", "progress");

-- CreateIndex
CREATE INDEX "StaffDevelopmentGoal_trainingRecordId_schoolId_idx" ON "StaffDevelopmentGoal"("trainingRecordId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDevelopmentGoal_id_schoolId_key" ON "StaffDevelopmentGoal"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "StaffDevelopmentPlan" ADD CONSTRAINT "StaffDevelopmentPlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDevelopmentPlan" ADD CONSTRAINT "StaffDevelopmentPlan_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDevelopmentPlan" ADD CONSTRAINT "StaffDevelopmentPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDevelopmentGoal" ADD CONSTRAINT "StaffDevelopmentGoal_planId_schoolId_fkey" FOREIGN KEY ("planId", "schoolId") REFERENCES "StaffDevelopmentPlan"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDevelopmentGoal" ADD CONSTRAINT "StaffDevelopmentGoal_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDevelopmentGoal" ADD CONSTRAINT "StaffDevelopmentGoal_trainingRecordId_schoolId_fkey" FOREIGN KEY ("trainingRecordId", "schoolId") REFERENCES "StaffTrainingRecord"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
