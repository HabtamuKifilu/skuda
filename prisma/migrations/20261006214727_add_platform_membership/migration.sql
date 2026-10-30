-- CreateEnum
CREATE TYPE "PlatformMembershipRole" AS ENUM ('PLATFORM_OWNER');

-- CreateTable
CREATE TABLE "PlatformMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlatformMembershipRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformMembership_userId_idx" ON "PlatformMembership"("userId");

-- CreateIndex
CREATE INDEX "PlatformMembership_role_idx" ON "PlatformMembership"("role");

-- CreateIndex
CREATE INDEX "PlatformMembership_isActive_idx" ON "PlatformMembership"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformMembership_userId_role_key" ON "PlatformMembership"("userId", "role");

-- AddForeignKey
ALTER TABLE "PlatformMembership" ADD CONSTRAINT "PlatformMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
