-- AlterTable
ALTER TABLE "StaffPerformanceCompetency" ADD COLUMN     "descriptionSnapshot" TEXT,
ADD COLUMN     "frameworkCompetencyId" TEXT,
ADD COLUMN     "frameworkId" TEXT,
ADD COLUMN     "frameworkNameSnapshot" TEXT,
ADD COLUMN     "ratingCriteriaSnapshot" JSONB;

-- CreateTable
CREATE TABLE "StaffPerformanceCompetencyFramework" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetJobTitle" TEXT,
    "targetDepartment" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPerformanceCompetencyFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPerformanceCompetencyDefinition" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rating1Criteria" TEXT NOT NULL,
    "rating2Criteria" TEXT NOT NULL,
    "rating3Criteria" TEXT NOT NULL,
    "rating4Criteria" TEXT NOT NULL,
    "rating5Criteria" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPerformanceCompetencyDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffPerformanceCompetencyFramework_schoolId_isActive_idx" ON "StaffPerformanceCompetencyFramework"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "StaffPerformanceCompetencyFramework_schoolId_targetJobTitle_idx" ON "StaffPerformanceCompetencyFramework"("schoolId", "targetJobTitle", "targetDepartment");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPerformanceCompetencyFramework_id_schoolId_key" ON "StaffPerformanceCompetencyFramework"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPerformanceCompetencyFramework_schoolId_name_key" ON "StaffPerformanceCompetencyFramework"("schoolId", "name");

-- CreateIndex
CREATE INDEX "StaffPerformanceCompetencyDefinition_schoolId_frameworkId_i_idx" ON "StaffPerformanceCompetencyDefinition"("schoolId", "frameworkId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPerformanceCompetencyDefinition_id_schoolId_key" ON "StaffPerformanceCompetencyDefinition"("id", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPerformanceCompetencyDefinition_frameworkId_name_key" ON "StaffPerformanceCompetencyDefinition"("frameworkId", "name");

-- CreateIndex
CREATE INDEX "StaffPerformanceCompetency_schoolId_frameworkId_idx" ON "StaffPerformanceCompetency"("schoolId", "frameworkId");

-- AddForeignKey
ALTER TABLE "StaffPerformanceCompetencyFramework" ADD CONSTRAINT "StaffPerformanceCompetencyFramework_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPerformanceCompetencyDefinition" ADD CONSTRAINT "StaffPerformanceCompetencyDefinition_frameworkId_schoolId_fkey" FOREIGN KEY ("frameworkId", "schoolId") REFERENCES "StaffPerformanceCompetencyFramework"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
