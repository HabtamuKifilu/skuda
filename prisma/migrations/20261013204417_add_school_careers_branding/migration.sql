-- AlterTable
ALTER TABLE "School" ADD COLUMN     "careersBrandColor" TEXT,
ADD COLUMN     "careersBrandingPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "careersCoverImageUrl" TEXT,
ADD COLUMN     "careersLogoUrl" TEXT,
ADD COLUMN     "careersMission" TEXT,
ADD COLUMN     "careersMotto" TEXT,
ADD COLUMN     "careersValues" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "careersWelcome" TEXT,
ADD COLUMN     "careersWhyJoin" TEXT;
