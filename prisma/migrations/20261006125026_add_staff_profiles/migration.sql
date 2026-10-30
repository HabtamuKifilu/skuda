-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'INACTIVE');

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "hireDate" TIMESTAMP(3),
    "jobTitle" TEXT,
    "department" TEXT,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffProfile_schoolId_idx" ON "StaffProfile"("schoolId");

-- CreateIndex
CREATE INDEX "StaffProfile_schoolId_status_idx" ON "StaffProfile"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StaffProfile_schoolId_lastName_firstName_idx" ON "StaffProfile"("schoolId", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_schoolId_employeeNumber_key" ON "StaffProfile"("schoolId", "employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
