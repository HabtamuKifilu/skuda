import { JobOpeningStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolSlug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { schoolSlug } = await context.params;
    const now = new Date();

    const school = await prisma.school.findFirst({
      where: {
        slug: schoolSlug,
        isActive: true,
      },
      select: {
        name: true,
        slug: true,
        city: true,
        careersBrandingPublished: true,
        careersPublishedBranding: true,
        jobOpenings: {
          where: {
            status: JobOpeningStatus.OPEN,
            isPublished: true,
            AND: [
              {
                OR: [
                  { openingDate: null },
                  { openingDate: { lte: now } },
                ],
              },
              {
                OR: [
                  { closingDate: null },
                  { closingDate: { gte: now } },
                ],
              },
            ],
          },
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            title: true,
            department: true,
            description: true,
            employmentType: true,
            openingDate: true,
            closingDate: true,
            documentRequirements: {
              orderBy: { documentType: "asc" },
              select: {
                documentType: true,
                label: true,
                isRequired: true,
              },
            },
          },
        },
      },
    });

    if (!school) {
      return Response.json(
        { error: "Careers page not found." },
        { status: 404 },
      );
    }

    const { careersBrandingPublished, careersPublishedBranding, ...publicSchool } = school;
    const snapshot = careersBrandingPublished &&
      careersPublishedBranding &&
      typeof careersPublishedBranding === "object" &&
      !Array.isArray(careersPublishedBranding)
        ? careersPublishedBranding as Record<string, unknown>
        : null;

    return Response.json({
      school: {
        ...publicSchool,
        branding: snapshot
          ? {
              motto: snapshot.careersMotto ?? null,
              welcome: snapshot.careersWelcome ?? null,
              mission: snapshot.careersMission ?? null,
              values: Array.isArray(snapshot.careersValues)
                ? snapshot.careersValues
                : [],
              whyJoin: snapshot.careersWhyJoin ?? null,
              logoUrl: snapshot.careersLogoUrl ?? null,
              coverImageUrl: snapshot.careersCoverImageUrl ?? null,
              brandColor: snapshot.careersBrandColor ?? null,
            }
          : null,
      },
      jobs: school.jobOpenings,
    });
  } catch (error) {
    console.error("Failed to load public careers:", error);
    return Response.json(
      { error: "Unable to load careers at this time." },
      { status: 500 },
    );
  }
}
