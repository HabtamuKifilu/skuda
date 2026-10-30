-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Grade_schoolId_idx" ON "Grade"("schoolId");

-- CreateIndex
CREATE INDEX "Grade_schoolId_isActive_idx" ON "Grade"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_schoolId_name_key" ON "Grade"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_schoolId_code_key" ON "Grade"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_schoolId_level_key" ON "Grade"("schoolId", "level");

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
