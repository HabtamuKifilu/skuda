-- CreateEnum
CREATE TYPE "SchoolMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'ACADEMIC_HEAD', 'ACCOUNTANT', 'TEACHER', 'REGISTRAR', 'HR_MANAGER', 'PARENT', 'STUDENT');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Ethiopia',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" "SchoolMembershipRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_slug_key" ON "School"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE INDEX "School_isActive_idx" ON "School"("isActive");

-- CreateIndex
CREATE INDEX "SchoolMembership_userId_idx" ON "SchoolMembership"("userId");

-- CreateIndex
CREATE INDEX "SchoolMembership_schoolId_idx" ON "SchoolMembership"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolMembership_schoolId_role_idx" ON "SchoolMembership"("schoolId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolMembership_userId_schoolId_role_key" ON "SchoolMembership"("userId", "schoolId", "role");

-- AddForeignKey
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
