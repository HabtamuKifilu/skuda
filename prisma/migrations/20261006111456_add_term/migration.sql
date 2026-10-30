-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Term_academicYearId_idx" ON "Term"("academicYearId");

-- CreateIndex
CREATE INDEX "Term_academicYearId_isCurrent_idx" ON "Term"("academicYearId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "Term_academicYearId_name_key" ON "Term"("academicYearId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Term_academicYearId_sequence_key" ON "Term"("academicYearId", "sequence");

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
