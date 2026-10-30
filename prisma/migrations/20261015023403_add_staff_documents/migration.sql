-- CreateEnum
CREATE TYPE "StaffDocumentType" AS ENUM ('EMPLOYMENT_CONTRACT', 'IDENTIFICATION', 'EDUCATIONAL_CERTIFICATE', 'EXPERIENCE_LETTER', 'PROFESSIONAL_CERTIFICATE', 'OTHER');

-- CreateTable
CREATE TABLE "StaffDocument" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "documentType" "StaffDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffDocument_schoolId_staffProfileId_idx" ON "StaffDocument"("schoolId", "staffProfileId");

-- CreateIndex
CREATE INDEX "StaffDocument_schoolId_documentType_idx" ON "StaffDocument"("schoolId", "documentType");

-- CreateIndex
CREATE INDEX "StaffDocument_schoolId_expiryDate_idx" ON "StaffDocument"("schoolId", "expiryDate");

-- CreateIndex
CREATE INDEX "StaffDocument_uploadedById_idx" ON "StaffDocument"("uploadedById");

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
