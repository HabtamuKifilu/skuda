-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Section_academicYearId_idx" ON "Section"("academicYearId");

-- CreateIndex
CREATE INDEX "Section_gradeId_idx" ON "Section"("gradeId");

-- CreateIndex
CREATE INDEX "Section_academicYearId_gradeId_idx" ON "Section"("academicYearId", "gradeId");

-- CreateIndex
CREATE INDEX "Section_academicYearId_isActive_idx" ON "Section"("academicYearId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Section_academicYearId_name_key" ON "Section"("academicYearId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Section_academicYearId_code_key" ON "Section"("academicYearId", "code");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
