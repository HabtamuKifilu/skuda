-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Period_schoolId_idx" ON "Period"("schoolId");

-- CreateIndex
CREATE INDEX "Period_schoolId_isActive_idx" ON "Period"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Period_schoolId_name_key" ON "Period"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Period_schoolId_sequence_key" ON "Period"("schoolId", "sequence");

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
