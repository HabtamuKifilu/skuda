-- CreateEnum
CREATE TYPE "AssessmentResultStatus" AS ENUM ('UNMARKED', 'SCORED', 'ABSENT', 'EXCUSED', 'EXEMPT');

-- AlterTable
ALTER TABLE "AssessmentResult" ADD COLUMN     "status" "AssessmentResultStatus" NOT NULL DEFAULT 'UNMARKED';

-- CreateIndex
CREATE INDEX "AssessmentResult_status_idx" ON "AssessmentResult"("status");

-- AddCheck
ALTER TABLE "AssessmentResult"
ADD CONSTRAINT "AssessmentResult_status_score_consistency_chk"
CHECK (
  ("status" = 'SCORED' AND "score" IS NOT NULL)
  OR
  ("status" <> 'SCORED' AND "score" IS NULL)
);
