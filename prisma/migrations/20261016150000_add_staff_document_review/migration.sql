-- Add review status and reviewer details to employee documents.
CREATE TYPE "StaffDocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "StaffDocument"
  ADD COLUMN "reviewStatus" "StaffDocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNotes" TEXT;

CREATE INDEX "StaffDocument_schoolId_reviewStatus_idx"
  ON "StaffDocument"("schoolId", "reviewStatus");
