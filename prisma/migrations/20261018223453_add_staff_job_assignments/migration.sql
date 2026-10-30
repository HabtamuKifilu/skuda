-- CreateEnum
CREATE TYPE "StaffJobAssignmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "JobTitle" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffJobAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "jobTitleId" TEXT NOT NULL,
    "departmentId" TEXT,
    "reportingManagerId" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvalRecordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffJobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffJobAssignmentRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "jobTitleId" TEXT NOT NULL,
    "departmentId" TEXT,
    "reportingManagerId" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "StaffJobAssignmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffJobAssignmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobTitle_schoolId_isActive_name_idx" ON "JobTitle"("schoolId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "JobTitle_schoolId_name_key" ON "JobTitle"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "JobTitle_id_schoolId_key" ON "JobTitle"("id", "schoolId");

-- CreateIndex
CREATE INDEX "Department_schoolId_isActive_name_idx" ON "Department"("schoolId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_schoolId_name_key" ON "Department"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_id_schoolId_key" ON "Department"("id", "schoolId");

-- CreateIndex
CREATE INDEX "StaffJobAssignment_schoolId_staffProfileId_effectiveDate_idx" ON "StaffJobAssignment"("schoolId", "staffProfileId", "effectiveDate");

-- CreateIndex
CREATE INDEX "StaffJobAssignment_schoolId_jobTitleId_idx" ON "StaffJobAssignment"("schoolId", "jobTitleId");

-- CreateIndex
CREATE INDEX "StaffJobAssignment_schoolId_departmentId_idx" ON "StaffJobAssignment"("schoolId", "departmentId");

-- CreateIndex
CREATE INDEX "StaffJobAssignment_schoolId_reportingManagerId_idx" ON "StaffJobAssignment"("schoolId", "reportingManagerId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffJobAssignment_id_schoolId_key" ON "StaffJobAssignment"("id", "schoolId");

-- CreateIndex
CREATE INDEX "StaffJobAssignmentRequest_schoolId_status_createdAt_idx" ON "StaffJobAssignmentRequest"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StaffJobAssignmentRequest_schoolId_staffProfileId_effective_idx" ON "StaffJobAssignmentRequest"("schoolId", "staffProfileId", "effectiveDate");

-- CreateIndex
CREATE INDEX "StaffJobAssignmentRequest_schoolId_reviewedById_idx" ON "StaffJobAssignmentRequest"("schoolId", "reviewedById");

-- CreateIndex
CREATE UNIQUE INDEX "StaffJobAssignmentRequest_id_schoolId_key" ON "StaffJobAssignmentRequest"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "JobTitle" ADD CONSTRAINT "JobTitle_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignment" ADD CONSTRAINT "StaffJobAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignment" ADD CONSTRAINT "StaffJobAssignment_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignment" ADD CONSTRAINT "StaffJobAssignment_jobTitleId_schoolId_fkey" FOREIGN KEY ("jobTitleId", "schoolId") REFERENCES "JobTitle"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignment" ADD CONSTRAINT "StaffJobAssignment_departmentId_schoolId_fkey" FOREIGN KEY ("departmentId", "schoolId") REFERENCES "Department"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignment" ADD CONSTRAINT "StaffJobAssignment_reportingManagerId_schoolId_fkey" FOREIGN KEY ("reportingManagerId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignment" ADD CONSTRAINT "StaffJobAssignment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignmentRequest" ADD CONSTRAINT "StaffJobAssignmentRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignmentRequest" ADD CONSTRAINT "StaffJobAssignmentRequest_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignmentRequest" ADD CONSTRAINT "StaffJobAssignmentRequest_jobTitleId_schoolId_fkey" FOREIGN KEY ("jobTitleId", "schoolId") REFERENCES "JobTitle"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignmentRequest" ADD CONSTRAINT "StaffJobAssignmentRequest_departmentId_schoolId_fkey" FOREIGN KEY ("departmentId", "schoolId") REFERENCES "Department"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignmentRequest" ADD CONSTRAINT "StaffJobAssignmentRequest_reportingManagerId_schoolId_fkey" FOREIGN KEY ("reportingManagerId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignmentRequest" ADD CONSTRAINT "StaffJobAssignmentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffJobAssignmentRequest" ADD CONSTRAINT "StaffJobAssignmentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BACKFILL_LEGACY_STAFF_JOB_ASSIGNMENTS
-- Preserve existing text values and scope all lookup records to their school.
-- Deterministic IDs make this backfill reproducible.
-- This migration does not change StaffProfile.jobTitle or StaffProfile.department.

-- Seed job titles from existing non-empty staff profile values.
INSERT INTO "JobTitle" (
    "id", "schoolId", "name", "isActive", "createdAt", "updatedAt"
)
SELECT
    'legacy_jobtitle_' || md5(source."schoolId" || ':' || source."name"),
    source."schoolId",
    source."name",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT
        sp."schoolId",
        BTRIM(sp."jobTitle") AS "name"
    FROM "StaffProfile" sp
    WHERE NULLIF(BTRIM(sp."jobTitle"), '') IS NOT NULL
) source
ON CONFLICT ("schoolId", "name") DO NOTHING;

-- Seed departments from existing non-empty staff profile values.
INSERT INTO "Department" (
    "id", "schoolId", "name", "isActive", "createdAt", "updatedAt"
)
SELECT
    'legacy_department_' || md5(source."schoolId" || ':' || source."name"),
    source."schoolId",
    source."name",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT
        sp."schoolId",
        BTRIM(sp."department") AS "name"
    FROM "StaffProfile" sp
    WHERE NULLIF(BTRIM(sp."department"), '') IS NOT NULL
) source
ON CONFLICT ("schoolId", "name") DO NOTHING;

-- Create one initial assignment for each legacy staff profile with a job title.
-- Prefer the recorded employment start date, then hire date, then profile creation.
-- Approval metadata stays NULL because historical approval details are unknown.
INSERT INTO "StaffJobAssignment" (
    "id",
    "schoolId",
    "staffProfileId",
    "jobTitleId",
    "departmentId",
    "effectiveDate",
    "createdAt"
)
SELECT
    'legacy_assignment_' || md5(sp."id"),
    sp."schoolId",
    sp."id",
    jt."id",
    dept."id",
    COALESCE(se."startDate", sp."hireDate", sp."createdAt"),
    CURRENT_TIMESTAMP
FROM "StaffProfile" sp
JOIN "JobTitle" jt
  ON jt."schoolId" = sp."schoolId"
 AND jt."name" = BTRIM(sp."jobTitle")
LEFT JOIN "Department" dept
  ON dept."schoolId" = sp."schoolId"
 AND dept."name" = NULLIF(BTRIM(sp."department"), '')
LEFT JOIN "StaffEmployment" se
  ON se."staffProfileId" = sp."id"
 AND se."schoolId" = sp."schoolId"
WHERE NULLIF(BTRIM(sp."jobTitle"), '') IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
