/*
  Warnings:

  - A unique constraint covering the columns `[id,schoolId]` on the table `StaffOffboarding` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StaffOffboardingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'WAIVED');

-- CreateEnum
CREATE TYPE "StaffOffboardingTaskCategory" AS ENUM ('HR_REVIEW', 'LEADERSHIP_APPROVAL', 'FINANCE_CLEARANCE', 'DEPARTMENT_CLEARANCE', 'ACADEMIC_HANDOVER', 'STUDENT_RECORDS_HANDOVER', 'PROPERTY_RETURN', 'ASSET_RETURN', 'EMPLOYEE_DOCUMENTS', 'EXIT_INTERVIEW', 'FINAL_SETTLEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffOffboardingAccessType" AS ENUM ('SCHOOL_MEMBERSHIP', 'USER_SESSION', 'EXTERNAL_SYSTEM', 'DEVICE', 'PHYSICAL_ACCESS', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffOffboardingAccessStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'REVOKED', 'NOT_APPLICABLE', 'FAILED');

-- CreateEnum
CREATE TYPE "StaffOffboardingSettlementStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PAYMENT_PENDING', 'PAID', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StaffOffboardingSettlementItemType" AS ENUM ('FINAL_SALARY', 'UNUSED_LEAVE_PAYOUT', 'APPROVED_EXPENSE', 'OUTSTANDING_ADVANCE', 'OTHER_ADJUSTMENT', 'CONTRACTUAL_BENEFIT', 'SEVERANCE', 'DEDUCTION');

-- CreateTable
CREATE TABLE "StaffOffboardingTask" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "offboardingId" TEXT NOT NULL,
    "category" "StaffOffboardingTaskCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "StaffOffboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "evidenceRef" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "exceptionReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffOffboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffOffboardingAccessRevocation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "offboardingId" TEXT NOT NULL,
    "accessType" "StaffOffboardingAccessType" NOT NULL,
    "target" TEXT NOT NULL,
    "status" "StaffOffboardingAccessStatus" NOT NULL DEFAULT 'PENDING',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "outcomeNotes" TEXT,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffOffboardingAccessRevocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffOffboardingSettlement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "offboardingId" TEXT NOT NULL,
    "status" "StaffOffboardingSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "preparedById" TEXT,
    "preparedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "paymentReference" TEXT,
    "paymentEvidenceRef" TEXT,
    "employeeAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgmentRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffOffboardingSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffOffboardingSettlementItem" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "itemType" "StaffOffboardingSettlementItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "calculationNotes" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffOffboardingSettlementItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffOffboardingTask_schoolId_offboardingId_status_idx" ON "StaffOffboardingTask"("schoolId", "offboardingId", "status");

-- CreateIndex
CREATE INDEX "StaffOffboardingTask_schoolId_assignedToId_status_idx" ON "StaffOffboardingTask"("schoolId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "StaffOffboardingTask_schoolId_dueDate_status_idx" ON "StaffOffboardingTask"("schoolId", "dueDate", "status");

-- CreateIndex
CREATE INDEX "StaffOffboardingTask_staffProfileId_createdAt_idx" ON "StaffOffboardingTask"("staffProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffOffboardingAccessRevocation_schoolId_offboardingId_sta_idx" ON "StaffOffboardingAccessRevocation"("schoolId", "offboardingId", "status");

-- CreateIndex
CREATE INDEX "StaffOffboardingAccessRevocation_schoolId_staffProfileId_idx" ON "StaffOffboardingAccessRevocation"("schoolId", "staffProfileId");

-- CreateIndex
CREATE INDEX "StaffOffboardingAccessRevocation_schoolId_accessType_status_idx" ON "StaffOffboardingAccessRevocation"("schoolId", "accessType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffOffboardingSettlement_offboardingId_key" ON "StaffOffboardingSettlement"("offboardingId");

-- CreateIndex
CREATE INDEX "StaffOffboardingSettlement_schoolId_status_createdAt_idx" ON "StaffOffboardingSettlement"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StaffOffboardingSettlement_staffProfileId_createdAt_idx" ON "StaffOffboardingSettlement"("staffProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffOffboardingSettlement_offboardingId_schoolId_key" ON "StaffOffboardingSettlement"("offboardingId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffOffboardingSettlement_id_schoolId_key" ON "StaffOffboardingSettlement"("id", "schoolId");

-- CreateIndex
CREATE INDEX "StaffOffboardingSettlementItem_schoolId_settlementId_idx" ON "StaffOffboardingSettlementItem"("schoolId", "settlementId");

-- CreateIndex
CREATE INDEX "StaffOffboardingSettlementItem_schoolId_itemType_idx" ON "StaffOffboardingSettlementItem"("schoolId", "itemType");

-- CreateIndex
CREATE UNIQUE INDEX "StaffOffboarding_id_schoolId_key" ON "StaffOffboarding"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "StaffOffboardingTask" ADD CONSTRAINT "StaffOffboardingTask_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboardingTask" ADD CONSTRAINT "StaffOffboardingTask_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboardingTask" ADD CONSTRAINT "StaffOffboardingTask_offboardingId_schoolId_fkey" FOREIGN KEY ("offboardingId", "schoolId") REFERENCES "StaffOffboarding"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboardingAccessRevocation" ADD CONSTRAINT "StaffOffboardingAccessRevocation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboardingAccessRevocation" ADD CONSTRAINT "StaffOffboardingAccessRevocation_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboardingAccessRevocation" ADD CONSTRAINT "StaffOffboardingAccessRevocation_offboardingId_schoolId_fkey" FOREIGN KEY ("offboardingId", "schoolId") REFERENCES "StaffOffboarding"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboardingSettlement" ADD CONSTRAINT "StaffOffboardingSettlement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboardingSettlement" ADD CONSTRAINT "StaffOffboardingSettlement_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboardingSettlement" ADD CONSTRAINT "StaffOffboardingSettlement_offboardingId_schoolId_fkey" FOREIGN KEY ("offboardingId", "schoolId") REFERENCES "StaffOffboarding"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboardingSettlementItem" ADD CONSTRAINT "StaffOffboardingSettlementItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboardingSettlementItem" ADD CONSTRAINT "StaffOffboardingSettlementItem_settlementId_schoolId_fkey" FOREIGN KEY ("settlementId", "schoolId") REFERENCES "StaffOffboardingSettlement"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
