-- CreateEnum
CREATE TYPE "StaffLeaveType" AS ENUM ('ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffLeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StaffLeaveRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "leaveType" "StaffLeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "StaffLeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_schoolId_status_startDate_idx" ON "StaffLeaveRequest"("schoolId", "status", "startDate");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_schoolId_staffProfileId_startDate_endDate_idx" ON "StaffLeaveRequest"("schoolId", "staffProfileId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_schoolId_requestedById_idx" ON "StaffLeaveRequest"("schoolId", "requestedById");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_schoolId_reviewedById_idx" ON "StaffLeaveRequest"("schoolId", "reviewedById");

-- CreateIndex
CREATE UNIQUE INDEX "StaffLeaveRequest_id_schoolId_key" ON "StaffLeaveRequest"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
