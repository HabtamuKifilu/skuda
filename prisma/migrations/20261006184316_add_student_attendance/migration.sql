-- CreateEnum
CREATE TYPE "StudentAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateTable
CREATE TABLE "StudentAttendance" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "StudentAttendanceStatus" NOT NULL,
    "minutesLate" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentAttendance_enrollmentId_idx" ON "StudentAttendance"("enrollmentId");

-- CreateIndex
CREATE INDEX "StudentAttendance_date_idx" ON "StudentAttendance"("date");

-- CreateIndex
CREATE INDEX "StudentAttendance_status_idx" ON "StudentAttendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttendance_enrollmentId_date_key" ON "StudentAttendance"("enrollmentId", "date");

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
