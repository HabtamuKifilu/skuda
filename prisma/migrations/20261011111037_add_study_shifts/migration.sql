-- AlterEnum
ALTER TYPE "Weekday" ADD VALUE 'SUNDAY';

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "studyShiftId" TEXT;

-- CreateTable
CREATE TABLE "StudyShift" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "operatingDays" "Weekday"[] DEFAULT ARRAY[]::"Weekday"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyShift_schoolId_idx" ON "StudyShift"("schoolId");

-- CreateIndex
CREATE INDEX "StudyShift_schoolId_isActive_idx" ON "StudyShift"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StudyShift_schoolId_name_key" ON "StudyShift"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StudyShift_schoolId_code_key" ON "StudyShift"("schoolId", "code");

-- CreateIndex
CREATE INDEX "Section_studyShiftId_idx" ON "Section"("studyShiftId");

-- AddForeignKey
ALTER TABLE "StudyShift" ADD CONSTRAINT "StudyShift_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_studyShiftId_fkey" FOREIGN KEY ("studyShiftId") REFERENCES "StudyShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
