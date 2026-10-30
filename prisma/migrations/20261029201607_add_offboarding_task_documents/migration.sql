-- CreateTable
CREATE TABLE "StaffOffboardingTaskDocument" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffOffboardingTaskDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffOffboardingTaskDocument_schoolId_taskId_createdAt_idx" ON "StaffOffboardingTaskDocument"("schoolId", "taskId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffOffboardingTaskDocument_uploadedById_idx" ON "StaffOffboardingTaskDocument"("uploadedById");

-- AddForeignKey
ALTER TABLE "StaffOffboardingTaskDocument" ADD CONSTRAINT "StaffOffboardingTaskDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffOffboardingTaskDocument" ADD CONSTRAINT "StaffOffboardingTaskDocument_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "StaffOffboardingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
