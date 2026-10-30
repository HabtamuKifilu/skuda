-- CreateEnum
CREATE TYPE "CareersImageKind" AS ENUM ('LOGO', 'COVER');

-- AlterTable
ALTER TABLE "JobApplicationDocument" ADD COLUMN     "data" BYTEA;

-- CreateTable
CREATE TABLE "CareersImage" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" "CareersImageKind" NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareersImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareersImage_schoolId_kind_idx" ON "CareersImage"("schoolId", "kind");

-- AddForeignKey
ALTER TABLE "CareersImage" ADD CONSTRAINT "CareersImage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
