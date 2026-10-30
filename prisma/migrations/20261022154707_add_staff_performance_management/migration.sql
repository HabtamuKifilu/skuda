-- CreateEnum
CREATE TYPE "PerformanceReviewCycleStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "StaffPerformanceReviewStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'ACKNOWLEDGED');

-- CreateTable
CREATE TABLE "PerformanceReviewCycle" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PerformanceReviewCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceReviewCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPerformanceReview" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "StaffPerformanceReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "overallRating" INTEGER,
    "strengths" TEXT,
    "improvementAreas" TEXT,
    "reviewerComments" TEXT,
    "employeeComments" TEXT,
    "submittedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPerformanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPerformanceCompetency" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "competency" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPerformanceCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceReviewCycle_schoolId_status_startDate_idx" ON "PerformanceReviewCycle"("schoolId", "status", "startDate");

-- CreateIndex
CREATE INDEX "PerformanceReviewCycle_schoolId_endDate_idx" ON "PerformanceReviewCycle"("schoolId", "endDate");

-- CreateIndex
CREATE INDEX "PerformanceReviewCycle_createdById_idx" ON "PerformanceReviewCycle"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceReviewCycle_id_schoolId_key" ON "PerformanceReviewCycle"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceReviewCycle_schoolId_name_key" ON "PerformanceReviewCycle"("schoolId", "name");

-- CreateIndex
CREATE INDEX "StaffPerformanceReview_schoolId_status_updatedAt_idx" ON "StaffPerformanceReview"("schoolId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "StaffPerformanceReview_schoolId_staffProfileId_createdAt_idx" ON "StaffPerformanceReview"("schoolId", "staffProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffPerformanceReview_schoolId_reviewerId_status_idx" ON "StaffPerformanceReview"("schoolId", "reviewerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPerformanceReview_id_schoolId_key" ON "StaffPerformanceReview"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPerformanceReview_cycleId_staffProfileId_key" ON "StaffPerformanceReview"("cycleId", "staffProfileId");

-- CreateIndex
CREATE INDEX "StaffPerformanceCompetency_schoolId_reviewId_idx" ON "StaffPerformanceCompetency"("schoolId", "reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPerformanceCompetency_reviewId_competency_key" ON "StaffPerformanceCompetency"("reviewId", "competency");

-- AddForeignKey
ALTER TABLE "PerformanceReviewCycle" ADD CONSTRAINT "PerformanceReviewCycle_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReviewCycle" ADD CONSTRAINT "PerformanceReviewCycle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceReview" ADD CONSTRAINT "StaffPerformanceReview_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceReview" ADD CONSTRAINT "StaffPerformanceReview_cycleId_schoolId_fkey" FOREIGN KEY ("cycleId", "schoolId") REFERENCES "PerformanceReviewCycle"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceReview" ADD CONSTRAINT "StaffPerformanceReview_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceReview" ADD CONSTRAINT "StaffPerformanceReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceCompetency" ADD CONSTRAINT "StaffPerformanceCompetency_reviewId_schoolId_fkey" FOREIGN KEY ("reviewId", "schoolId") REFERENCES "StaffPerformanceReview"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
