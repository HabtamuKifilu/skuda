-- Extended onboarding workflows. Apply after add_staff_document_review.

CREATE TYPE "StaffOnboardingRequirementType" AS ENUM (
  'ORIENTATION',
  'POLICY_ACKNOWLEDGEMENT'
);

CREATE TYPE "StaffProbationReviewOutcome" AS ENUM (
  'PENDING',
  'PASSED',
  'EXTENDED',
  'FAILED'
);

CREATE TYPE "StaffAccountAccessRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

ALTER TABLE "StaffOnboarding"
  ADD COLUMN "accountAccessRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "StaffOnboardingRequirement" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "StaffOnboardingRequirementType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "version" TEXT NOT NULL DEFAULT '1',
  "required" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffOnboardingRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffOnboardingAcknowledgement" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "onboardingId" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "acknowledgedById" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffOnboardingAcknowledgement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffProbationReview" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "onboardingId" TEXT NOT NULL,
  "staffProfileId" TEXT NOT NULL,
  "probationStartDate" TIMESTAMP(3) NOT NULL,
  "probationEndDate" TIMESTAMP(3) NOT NULL,
  "reviewDueDate" TIMESTAMP(3) NOT NULL,
  "outcome" "StaffProbationReviewOutcome" NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "nextReviewDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffProbationReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffAccountAccessRequest" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "onboardingId" TEXT NOT NULL,
  "staffProfileId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "requestedRole" "SchoolMembershipRole" NOT NULL,
  "status" "StaffAccountAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestNotes" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffAccountAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffDocumentRequirement" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "documentType" "StaffDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffDocumentRequirement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffOnboardingRequirement_schoolId_code_key"
  ON "StaffOnboardingRequirement"("schoolId", "code");
CREATE UNIQUE INDEX "StaffOnboardingRequirement_id_schoolId_key"
  ON "StaffOnboardingRequirement"("id", "schoolId");
CREATE INDEX "StaffOnboardingRequirement_schoolId_type_isActive_idx"
  ON "StaffOnboardingRequirement"("schoolId", "type", "isActive");

CREATE UNIQUE INDEX "StaffOnboardingAcknowledgement_onboardingId_requirementId_key"
  ON "StaffOnboardingAcknowledgement"("onboardingId", "requirementId");
CREATE INDEX "StaffOnboardingAcknowledgement_schoolId_acknowledgedAt_idx"
  ON "StaffOnboardingAcknowledgement"("schoolId", "acknowledgedAt");

CREATE INDEX "StaffProbationReview_schoolId_reviewDueDate_outcome_idx"
  ON "StaffProbationReview"("schoolId", "reviewDueDate", "outcome");
CREATE INDEX "StaffProbationReview_onboardingId_reviewDueDate_idx"
  ON "StaffProbationReview"("onboardingId", "reviewDueDate");
CREATE INDEX "StaffProbationReview_staffProfileId_probationEndDate_idx"
  ON "StaffProbationReview"("staffProfileId", "probationEndDate");

CREATE INDEX "StaffAccountAccessRequest_schoolId_status_createdAt_idx"
  ON "StaffAccountAccessRequest"("schoolId", "status", "createdAt");
CREATE INDEX "StaffAccountAccessRequest_onboardingId_status_idx"
  ON "StaffAccountAccessRequest"("onboardingId", "status");
CREATE INDEX "StaffAccountAccessRequest_staffProfileId_status_idx"
  ON "StaffAccountAccessRequest"("staffProfileId", "status");

CREATE UNIQUE INDEX "StaffDocumentRequirement_schoolId_documentType_key"
  ON "StaffDocumentRequirement"("schoolId", "documentType");
CREATE UNIQUE INDEX "StaffDocumentRequirement_id_schoolId_key"
  ON "StaffDocumentRequirement"("id", "schoolId");
CREATE INDEX "StaffDocumentRequirement_schoolId_isActive_required_idx"
  ON "StaffDocumentRequirement"("schoolId", "isActive", "required");

ALTER TABLE "StaffOnboardingRequirement"
  ADD CONSTRAINT "StaffOnboardingRequirement_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffOnboardingAcknowledgement"
  ADD CONSTRAINT "StaffOnboardingAcknowledgement_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffOnboardingAcknowledgement_onboardingId_schoolId_fkey"
  FOREIGN KEY ("onboardingId", "schoolId")
  REFERENCES "StaffOnboarding"("id", "schoolId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffOnboardingAcknowledgement_requirementId_schoolId_fkey"
  FOREIGN KEY ("requirementId", "schoolId")
  REFERENCES "StaffOnboardingRequirement"("id", "schoolId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffProbationReview"
  ADD CONSTRAINT "StaffProbationReview_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffProbationReview_onboardingId_schoolId_fkey"
  FOREIGN KEY ("onboardingId", "schoolId")
  REFERENCES "StaffOnboarding"("id", "schoolId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffProbationReview_staffProfileId_schoolId_fkey"
  FOREIGN KEY ("staffProfileId", "schoolId")
  REFERENCES "StaffProfile"("id", "schoolId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffAccountAccessRequest"
  ADD CONSTRAINT "StaffAccountAccessRequest_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffAccountAccessRequest_onboardingId_schoolId_fkey"
  FOREIGN KEY ("onboardingId", "schoolId")
  REFERENCES "StaffOnboarding"("id", "schoolId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffAccountAccessRequest_staffProfileId_schoolId_fkey"
  FOREIGN KEY ("staffProfileId", "schoolId")
  REFERENCES "StaffProfile"("id", "schoolId")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffAccountAccessRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StaffAccountAccessRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffDocumentRequirement"
  ADD CONSTRAINT "StaffDocumentRequirement_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
