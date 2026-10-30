-- CreateEnum
CREATE TYPE "StaffOffboardingType" AS ENUM ('RESIGNATION', 'RETIREMENT', 'FIXED_TERM_END', 'REDUNDANCY', 'DISMISSAL', 'PROBATION_TERMINATION', 'MUTUAL_AGREEMENT', 'DEATH', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffOffboardingInitiator" AS ENUM ('EMPLOYEE', 'SCHOOL', 'MUTUAL');

-- CreateEnum
CREATE TYPE "StaffOffboardingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'COMPLETED');

-- CreateTable
CREATE TABLE "StaffOffboarding" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "exitType" "StaffOffboardingType" NOT NULL,
    "initiator" "StaffOffboardingInitiator" NOT NULL,
    "status" "StaffOffboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "reasonCategory" TEXT,
    "reasonNotes" TEXT,
    "confidentialNotes" TEXT,
    "noticeRequired" BOOLEAN NOT NULL DEFAULT false,
    "noticeGiven" BOOLEAN NOT NULL DEFAULT false,
    "noticeDate" TIMESTAMP(3),
    "submissionDate" TIMESTAMP(3),
    "proposedLastDay" TIMESTAMP(3),
    "confirmedLastDay" TIMESTAMP(3),
    "effectiveTerminationDate" TIMESTAMP(3),
    "rehireEligible" BOOLEAN,
    "rehireDecisionNotes" TEXT,
    "rehireDecidedById" TEXT,
    "rehireDecidedAt" TIMESTAMP(3),
    "responsibleHrId" TEXT,
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "disputePending" BOOLEAN NOT NULL DEFAULT false,
    "investigationPending" BOOLEAN NOT NULL DEFAULT false,
    "exitInterviewCompleted" BOOLEAN NOT NULL DEFAULT false,
    "feedbackNotes" TEXT,
    "handoverConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffOffboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffOffboarding_schoolId_status_idx" ON "StaffOffboarding"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StaffOffboarding_schoolId_exitType_idx" ON "StaffOffboarding"("schoolId", "exitType");

-- CreateIndex
CREATE INDEX "StaffOffboarding_schoolId_proposedLastDay_idx" ON "StaffOffboarding"("schoolId", "proposedLastDay");

-- CreateIndex
CREATE INDEX "StaffOffboarding_staffProfileId_createdAt_idx" ON "StaffOffboarding"("staffProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffOffboarding_schoolId_responsibleHrId_idx" ON "StaffOffboarding"("schoolId", "responsibleHrId");

-- AddForeignKey
ALTER TABLE "StaffOffboarding" ADD CONSTRAINT "StaffOffboarding_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboarding" ADD CONSTRAINT "StaffOffboarding_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
