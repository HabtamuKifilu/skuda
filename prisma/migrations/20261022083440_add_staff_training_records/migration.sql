-- CreateEnum
CREATE TYPE "StaffTrainingStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StaffTrainingRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "trainingType" TEXT,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "status" "StaffTrainingStatus" NOT NULL DEFAULT 'PLANNED',
    "outcome" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffTrainingRecord_schoolId_staffProfileId_startDate_idx" ON "StaffTrainingRecord"("schoolId", "staffProfileId", "startDate");

-- CreateIndex
CREATE INDEX "StaffTrainingRecord_schoolId_status_startDate_idx" ON "StaffTrainingRecord"("schoolId", "status", "startDate");

-- CreateIndex
CREATE INDEX "StaffTrainingRecord_createdById_idx" ON "StaffTrainingRecord"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTrainingRecord_id_schoolId_key" ON "StaffTrainingRecord"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "StaffTrainingRecord" ADD CONSTRAINT "StaffTrainingRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTrainingRecord" ADD CONSTRAINT "StaffTrainingRecord_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
