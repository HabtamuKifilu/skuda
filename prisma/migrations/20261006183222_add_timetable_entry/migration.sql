-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "subjectOfferingId" TEXT NOT NULL,
    "teacherAssignmentId" TEXT,
    "weekday" "Weekday" NOT NULL,
    "room" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimetableEntry_sectionId_idx" ON "TimetableEntry"("sectionId");

-- CreateIndex
CREATE INDEX "TimetableEntry_periodId_idx" ON "TimetableEntry"("periodId");

-- CreateIndex
CREATE INDEX "TimetableEntry_subjectOfferingId_idx" ON "TimetableEntry"("subjectOfferingId");

-- CreateIndex
CREATE INDEX "TimetableEntry_teacherAssignmentId_idx" ON "TimetableEntry"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "TimetableEntry_weekday_periodId_idx" ON "TimetableEntry"("weekday", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableEntry_sectionId_weekday_periodId_key" ON "TimetableEntry"("sectionId", "weekday", "periodId");

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_subjectOfferingId_fkey" FOREIGN KEY ("subjectOfferingId") REFERENCES "SubjectOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
