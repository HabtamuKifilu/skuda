/*
  Warnings:

  - A unique constraint covering the columns `[schoolId,type]` on the table `StudyShift` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `type` to the `StudyShift` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StudyShiftType" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'WEEKEND');

-- AlterTable
ALTER TABLE "StudyShift" ADD COLUMN     "type" "StudyShiftType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "StudyShift_schoolId_type_key" ON "StudyShift"("schoolId", "type");
