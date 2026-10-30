/*
  Warnings:

  - You are about to drop the column `academicYearId` on the `SubjectOffering` table. All the data in the column will be lost.
  - You are about to drop the column `gradeId` on the `SubjectOffering` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sectionId,subjectId]` on the table `SubjectOffering` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sectionId` to the `SubjectOffering` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SubjectOffering" DROP CONSTRAINT "SubjectOffering_academicYearId_fkey";

-- DropForeignKey
ALTER TABLE "SubjectOffering" DROP CONSTRAINT "SubjectOffering_gradeId_fkey";

-- DropIndex
DROP INDEX "SubjectOffering_academicYearId_gradeId_idx";

-- DropIndex
DROP INDEX "SubjectOffering_academicYearId_gradeId_subjectId_key";

-- DropIndex
DROP INDEX "SubjectOffering_academicYearId_idx";

-- DropIndex
DROP INDEX "SubjectOffering_academicYearId_isActive_idx";

-- DropIndex
DROP INDEX "SubjectOffering_gradeId_idx";

-- AlterTable
ALTER TABLE "SubjectOffering" DROP COLUMN "academicYearId",
DROP COLUMN "gradeId",
ADD COLUMN     "sectionId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "SubjectOffering_sectionId_idx" ON "SubjectOffering"("sectionId");

-- CreateIndex
CREATE INDEX "SubjectOffering_sectionId_isActive_idx" ON "SubjectOffering"("sectionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectOffering_sectionId_subjectId_key" ON "SubjectOffering"("sectionId", "subjectId");

-- AddForeignKey
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
