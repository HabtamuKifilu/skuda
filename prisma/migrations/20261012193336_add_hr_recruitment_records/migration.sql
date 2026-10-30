-- CreateEnum
CREATE TYPE "JobOpeningStatus" AS ENUM ('DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobApplicationStage" AS ENUM ('RECEIVED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "JobOpening" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "description" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "status" "JobOpeningStatus" NOT NULL DEFAULT 'DRAFT',
    "openingDate" TIMESTAMP(3),
    "closingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "jobOpeningId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "stage" "JobApplicationStage" NOT NULL DEFAULT 'RECEIVED',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interviewNotes" TEXT,
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobOpening_schoolId_status_createdAt_idx" ON "JobOpening"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "JobOpening_schoolId_department_idx" ON "JobOpening"("schoolId", "department");

-- CreateIndex
CREATE INDEX "JobOpening_schoolId_closingDate_idx" ON "JobOpening"("schoolId", "closingDate");

-- CreateIndex
CREATE UNIQUE INDEX "JobOpening_id_schoolId_key" ON "JobOpening"("id", "schoolId");

-- CreateIndex
CREATE INDEX "JobApplication_schoolId_stage_appliedAt_idx" ON "JobApplication"("schoolId", "stage", "appliedAt");

-- CreateIndex
CREATE INDEX "JobApplication_jobOpeningId_stage_idx" ON "JobApplication"("jobOpeningId", "stage");

-- CreateIndex
CREATE INDEX "JobApplication_schoolId_email_idx" ON "JobApplication"("schoolId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_id_schoolId_key" ON "JobApplication"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobOpeningId_schoolId_fkey" FOREIGN KEY ("jobOpeningId", "schoolId") REFERENCES "JobOpening"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
