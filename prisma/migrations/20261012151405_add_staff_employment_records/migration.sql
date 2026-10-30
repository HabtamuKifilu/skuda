-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'CONTRACT', 'TEMPORARY', 'PART_TIME', 'PROBATION', 'INTERN', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "EmploymentChangeType" AS ENUM ('HIRED', 'PROMOTION', 'TRANSFER', 'CONTRACT_STARTED', 'CONTRACT_RENEWED', 'CONTRACT_CHANGED', 'ROLE_CHANGED', 'DEPARTMENT_CHANGED', 'OTHER');

-- CreateTable
CREATE TABLE "StaffEmployment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "startDate" TIMESTAMP(3),
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "contractReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffEmployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffEmploymentHistory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "changeType" "EmploymentChangeType" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "previousJobTitle" TEXT,
    "newJobTitle" TEXT,
    "previousDepartment" TEXT,
    "newDepartment" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffEmploymentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_id_schoolId_key" ON "StaffProfile"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffEmployment_staffProfileId_key" ON "StaffEmployment"("staffProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffEmployment_staffProfileId_schoolId_key" ON "StaffEmployment"("staffProfileId", "schoolId");

-- CreateIndex
CREATE INDEX "StaffEmployment_schoolId_idx" ON "StaffEmployment"("schoolId");

-- CreateIndex
CREATE INDEX "StaffEmployment_schoolId_employmentType_idx" ON "StaffEmployment"("schoolId", "employmentType");

-- CreateIndex
CREATE INDEX "StaffEmployment_schoolId_contractEndDate_idx" ON "StaffEmployment"("schoolId", "contractEndDate");

-- CreateIndex
CREATE INDEX "StaffEmploymentHistory_schoolId_effectiveDate_idx" ON "StaffEmploymentHistory"("schoolId", "effectiveDate");

-- CreateIndex
CREATE INDEX "StaffEmploymentHistory_staffProfileId_effectiveDate_idx" ON "StaffEmploymentHistory"("staffProfileId", "effectiveDate");

-- CreateIndex
CREATE INDEX "StaffEmploymentHistory_schoolId_changeType_idx" ON "StaffEmploymentHistory"("schoolId", "changeType");

-- AddForeignKey
ALTER TABLE "StaffEmployment" ADD CONSTRAINT "StaffEmployment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmployment" ADD CONSTRAINT "StaffEmployment_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmploymentHistory" ADD CONSTRAINT "StaffEmploymentHistory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmploymentHistory" ADD CONSTRAINT "StaffEmploymentHistory_staffProfileId_schoolId_fkey" FOREIGN KEY ("staffProfileId", "schoolId") REFERENCES "StaffProfile"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
