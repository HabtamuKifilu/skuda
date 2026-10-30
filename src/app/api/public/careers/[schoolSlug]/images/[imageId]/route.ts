import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ schoolSlug: string; imageId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { schoolSlug, imageId } = await context.params;

    const school = await prisma.school.findFirst({
      where: {
        slug: schoolSlug,
        isActive: true,
        careersBrandingPublished: true,
      },
      select: {
        id: true,
        careersPublishedBranding: true,
      },
    });

    if (!school) {
      return new Response("Image not found.", { status: 404 });
    }

    const snapshot = school.careersPublishedBranding;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return new Response("Image not found.", { status: 404 });
    }

    const branding = snapshot as Record<string, unknown>;
    const expectedUrl =
      "/api/public/careers/" +
      encodeURIComponent(schoolSlug) +
      "/images/" +
      encodeURIComponent(imageId);

    if (
      branding.careersLogoUrl !== expectedUrl &&
      branding.careersCoverImageUrl !== expectedUrl
    ) {
      return new Response("Image not found.", { status: 404 });
    }

    const image = await prisma.careersImage.findFirst({
      where: { id: imageId, schoolId: school.id },
      select: { contentType: true, data: true },
    });

    if (!image) {
      return new Response("Image not found.", { status: 404 });
    }

    return new Response(new Uint8Array(image.data), {
      status: 200,
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": String(image.data.byteLength),
        "Cache-Control": "public, max-age=3600, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to serve public careers image:", error);
    return new Response("Unable to load image.", { status: 500 });
  }
}
