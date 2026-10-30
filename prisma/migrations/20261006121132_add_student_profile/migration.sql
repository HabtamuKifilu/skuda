-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "studentNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "admissionDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentProfile_schoolId_idx" ON "StudentProfile"("schoolId");

-- CreateIndex
CREATE INDEX "StudentProfile_schoolId_isActive_idx" ON "StudentProfile"("schoolId", "isActive");

-- CreateIndex
CREATE INDEX "StudentProfile_schoolId_lastName_firstName_idx" ON "StudentProfile"("schoolId", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_schoolId_studentNumber_key" ON "StudentProfile"("schoolId", "studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
