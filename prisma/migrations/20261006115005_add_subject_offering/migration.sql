-- CreateTable
CREATE TABLE "SubjectOffering" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectOffering_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectOffering_academicYearId_idx" ON "SubjectOffering"("academicYearId");

-- CreateIndex
CREATE INDEX "SubjectOffering_gradeId_idx" ON "SubjectOffering"("gradeId");

-- CreateIndex
CREATE INDEX "SubjectOffering_subjectId_idx" ON "SubjectOffering"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectOffering_academicYearId_gradeId_idx" ON "SubjectOffering"("academicYearId", "gradeId");

-- CreateIndex
CREATE INDEX "SubjectOffering_academicYearId_isActive_idx" ON "SubjectOffering"("academicYearId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectOffering_academicYearId_gradeId_subjectId_key" ON "SubjectOffering"("academicYearId", "gradeId", "subjectId");

-- AddForeignKey
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
