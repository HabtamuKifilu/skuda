-- CreateEnum
CREATE TYPE "ApplicationDocumentType" AS ENUM ('CV', 'EDUCATIONAL_CERTIFICATE', 'EXPERIENCE_LETTER', 'APPLICATION_LETTER', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationDocumentStatus" AS ENUM ('PENDING', 'UPLOADED', 'REJECTED');

-- CreateTable
CREATE TABLE "JobOpeningDocumentRequirement" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "jobOpeningId" TEXT NOT NULL,
    "documentType" "ApplicationDocumentType" NOT NULL,
    "label" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOpeningDocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplicationDocument" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentType" "ApplicationDocumentType" NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "ApplicationDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobOpeningDocumentRequirement_schoolId_jobOpeningId_idx" ON "JobOpeningDocumentRequirement"("schoolId", "jobOpeningId");

-- CreateIndex
CREATE UNIQUE INDEX "JobOpeningDocumentRequirement_jobOpeningId_documentType_key" ON "JobOpeningDocumentRequirement"("jobOpeningId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplicationDocument_storageKey_key" ON "JobApplicationDocument"("storageKey");

-- CreateIndex
CREATE INDEX "JobApplicationDocument_schoolId_applicationId_idx" ON "JobApplicationDocument"("schoolId", "applicationId");

-- CreateIndex
CREATE INDEX "JobApplicationDocument_applicationId_documentType_idx" ON "JobApplicationDocument"("applicationId", "documentType");

-- CreateIndex
CREATE INDEX "JobApplicationDocument_schoolId_status_idx" ON "JobApplicationDocument"("schoolId", "status");

-- AddForeignKey
ALTER TABLE "JobOpeningDocumentRequirement" ADD CONSTRAINT "JobOpeningDocumentRequirement_jobOpeningId_schoolId_fkey" FOREIGN KEY ("jobOpeningId", "schoolId") REFERENCES "JobOpening"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicationDocument" ADD CONSTRAINT "JobApplicationDocument_applicationId_schoolId_fkey" FOREIGN KEY ("applicationId", "schoolId") REFERENCES "JobApplication"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
