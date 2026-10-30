-- CreateEnum
CREATE TYPE "StaffAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'SICK', 'APPROVED_ABSENCE');

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "StaffAttendanceStatus" NOT NULL,
    "minutesLate" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAttendance_staffProfileId_idx" ON "StaffAttendance"("staffProfileId");

-- CreateIndex
CREATE INDEX "StaffAttendance_date_idx" ON "StaffAttendance"("date");

-- CreateIndex
CREATE INDEX "StaffAttendance_status_idx" ON "StaffAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_staffProfileId_date_key" ON "StaffAttendance"("staffProfileId", "date");

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
