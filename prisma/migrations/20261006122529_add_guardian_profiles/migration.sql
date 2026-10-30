-- CreateTable
CREATE TABLE "GuardianProfile" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "occupation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardianProfile_schoolId_idx" ON "GuardianProfile"("schoolId");

-- CreateIndex
CREATE INDEX "GuardianProfile_schoolId_isActive_idx" ON "GuardianProfile"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "GuardianProfile_schoolId_lastName_firstName_idx" ON "GuardianProfile"("schoolId", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianProfile_userId_key" ON "GuardianProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentGuardian_studentId_idx" ON "StudentGuardian"("studentId");

-- CreateIndex
CREATE INDEX "StudentGuardian_guardianId_idx" ON "StudentGuardian"("guardianId");

-- CreateIndex
CREATE INDEX "StudentGuardian_studentId_isPrimary_idx" ON "StudentGuardian"("studentId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_studentId_guardianId_key" ON "StudentGuardian"("studentId", "guardianId");

-- AddForeignKey
ALTER TABLE "GuardianProfile" ADD CONSTRAINT "GuardianProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianProfile" ADD CONSTRAINT "GuardianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "GuardianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
