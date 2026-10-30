-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('QUIZ', 'ASSIGNMENT', 'PROJECT', 'PRACTICAL', 'MIDTERM', 'FINAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'MARKING', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "GradingScale" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingScaleItem" (
    "id" TEXT NOT NULL,
    "gradingScaleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minPercent" DECIMAL(5,2) NOT NULL,
    "maxPercent" DECIMAL(5,2) NOT NULL,
    "points" DECIMAL(5,3),
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingScaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "subjectOfferingId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT,
    "name" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL,
    "maxScore" DECIMAL(8,3) NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "assessmentDate" TIMESTAMP(3),
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResult" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "score" DECIMAL(8,3),
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GradingScale_academicYearId_key" ON "GradingScale"("academicYearId");

-- CreateIndex
CREATE INDEX "GradingScaleItem_gradingScaleId_idx" ON "GradingScaleItem"("gradingScaleId");

-- CreateIndex
CREATE UNIQUE INDEX "GradingScaleItem_gradingScaleId_label_key" ON "GradingScaleItem"("gradingScaleId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "GradingScaleItem_gradingScaleId_sequence_key" ON "GradingScaleItem"("gradingScaleId", "sequence");

-- CreateIndex
CREATE INDEX "Assessment_termId_idx" ON "Assessment"("termId");

-- CreateIndex
CREATE INDEX "Assessment_subjectOfferingId_idx" ON "Assessment"("subjectOfferingId");

-- CreateIndex
CREATE INDEX "Assessment_teacherAssignmentId_idx" ON "Assessment"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "Assessment_termId_subjectOfferingId_idx" ON "Assessment"("termId", "subjectOfferingId");

-- CreateIndex
CREATE INDEX "Assessment_status_idx" ON "Assessment"("status");

-- CreateIndex
CREATE INDEX "AssessmentResult_assessmentId_idx" ON "AssessmentResult"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentResult_enrollmentId_idx" ON "AssessmentResult"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResult_assessmentId_enrollmentId_key" ON "AssessmentResult"("assessmentId", "enrollmentId");

-- AddForeignKey
ALTER TABLE "GradingScale" ADD CONSTRAINT "GradingScale_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradingScaleItem" ADD CONSTRAINT "GradingScaleItem_gradingScaleId_fkey" FOREIGN KEY ("gradingScaleId") REFERENCES "GradingScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_subjectOfferingId_fkey" FOREIGN KEY ("subjectOfferingId") REFERENCES "SubjectOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Assessment and grading data integrity checks
ALTER TABLE "GradingScaleItem"
  ADD CONSTRAINT "GradingScaleItem_minPercent_nonnegative_chk"
  CHECK ("minPercent" >= 0);

ALTER TABLE "GradingScaleItem"
  ADD CONSTRAINT "GradingScaleItem_maxPercent_max100_chk"
  CHECK ("maxPercent" <= 100);

ALTER TABLE "GradingScaleItem"
  ADD CONSTRAINT "GradingScaleItem_percent_range_chk"
  CHECK ("minPercent" < "maxPercent");

ALTER TABLE "GradingScaleItem"
  ADD CONSTRAINT "GradingScaleItem_points_nonnegative_chk"
  CHECK ("points" IS NULL OR "points" >= 0);

ALTER TABLE "GradingScaleItem"
  ADD CONSTRAINT "GradingScaleItem_sequence_positive_chk"
  CHECK ("sequence" > 0);

ALTER TABLE "Assessment"
  ADD CONSTRAINT "Assessment_maxScore_positive_chk"
  CHECK ("maxScore" > 0);

ALTER TABLE "Assessment"
  ADD CONSTRAINT "Assessment_weight_range_chk"
  CHECK ("weight" > 0 AND "weight" <= 100);

ALTER TABLE "AssessmentResult"
  ADD CONSTRAINT "AssessmentResult_score_nonnegative_chk"
  CHECK ("score" IS NULL OR "score" >= 0);
