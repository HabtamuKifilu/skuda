-- CreateEnum
CREATE TYPE "TeacherAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "TeacherAssignment" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "subjectOfferingId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "TeacherAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherAssignment_staffProfileId_idx" ON "TeacherAssignment"("staffProfileId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_subjectOfferingId_idx" ON "TeacherAssignment"("subjectOfferingId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_staffProfileId_status_idx" ON "TeacherAssignment"("staffProfileId", "status");

-- CreateIndex
CREATE INDEX "TeacherAssignment_subjectOfferingId_status_idx" ON "TeacherAssignment"("subjectOfferingId", "status");

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_subjectOfferingId_fkey" FOREIGN KEY ("subjectOfferingId") REFERENCES "SubjectOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
