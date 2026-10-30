import { NextRequest } from "next/server";
import { Prisma, SchoolMembershipRole } from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const brandingRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
];

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

const brandingSelect = {
  careersMotto: true,
  careersWelcome: true,
  careersMission: true,
  careersValues: true,
  careersWhyJoin: true,
  careersLogoUrl: true,
  careersCoverImageUrl: true,
  careersBrandColor: true,
  careersBrandingPublished: true,
} as const;

type BrandingInput = {
  careersMotto: string | null;
  careersWelcome: string | null;
  careersMission: string | null;
  careersValues: string[];
  careersWhyJoin: string | null;
  careersLogoUrl: string | null;
  careersCoverImageUrl: string | null;
  careersBrandColor: string | null;
};

function parseBranding(body: unknown):
  | { data: BrandingInput }
  | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "A valid branding object is required." };
  }

  const input = body as Record<string, unknown>;

  function optionalText(
    key: string,
    maxLength: number,
  ): string | null | undefined {
    const value = input[key];
    if (value === undefined) return null;
    if (value === null || value === "") return null;
    if (typeof value !== "string") return undefined;

    const trimmed = value.trim();
    if (trimmed.length > maxLength) return undefined;
    return trimmed || null;
  }

  function optionalUrl(key: string): string | null | undefined {
    const value = optionalText(key, 2048);
    if (value === undefined || value === null) return value;

    // Allow only SKUDA's own public careers-image endpoint as a relative URL.
    if (
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("\\") &&
      /^\/api\/public\/careers\/[^/?#]+\/images\/[^/?#]+$/.test(value)
    ) {
      return value;
    }

    // External image URLs must be absolute HTTP or HTTPS URLs.
    try {
      const url = new URL(value);
      if (
        (url.protocol !== "https:" && url.protocol !== "http:") ||
        !url.hostname
      ) {
        return undefined;
      }
      return value;
    } catch {
      return undefined;
    }
  }

  const careersMotto = optionalText("careersMotto", 180);
  const careersWelcome = optionalText("careersWelcome", 3000);
  const careersMission = optionalText("careersMission", 3000);
  const careersWhyJoin = optionalText("careersWhyJoin", 3000);
  const careersLogoUrl = optionalUrl("careersLogoUrl");
  const careersCoverImageUrl = optionalUrl("careersCoverImageUrl");

  const rawValues = input.careersValues;
  let careersValues: string[] = [];

  if (rawValues !== undefined && !Array.isArray(rawValues)) {
    return { error: "Core values must be provided as a list." };
  }

  if (Array.isArray(rawValues)) {
    if (
      rawValues.length > 8 ||
      rawValues.some(
        (value) =>
          typeof value !== "string" ||
          value.trim().length === 0 ||
          value.trim().length > 120,
      )
    ) {
      return {
        error: "Provide up to 8 core values, each between 1 and 120 characters.",
      };
    }
    careersValues = rawValues.map((value: string) => value.trim());
  }

  const rawColor = input.careersBrandColor;
  let careersBrandColor: string | null = null;

  if (rawColor !== undefined && rawColor !== null && rawColor !== "") {
    if (typeof rawColor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(rawColor)) {
      return { error: "Brand color must be a six-digit hex color such as #263A80." };
    }
    careersBrandColor = rawColor;
  }

  if (
    careersMotto === undefined ||
    careersWelcome === undefined ||
    careersMission === undefined ||
    careersWhyJoin === undefined ||
    careersLogoUrl === undefined ||
    careersCoverImageUrl === undefined
  ) {
    return {
      error:
        "Check text lengths and ensure logo and cover image URLs use HTTP or HTTPS.",
    };
  }

  return {
    data: {
      careersMotto,
      careersWelcome,
      careersMission,
      careersValues,
      careersWhyJoin,
      careersLogoUrl,
      careersCoverImageUrl,
      careersBrandColor,
    },
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, brandingRoles);

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        slug: true,
        ...brandingSelect,
      },
    });

    if (!school) {
      return Response.json({ error: "School not found." }, { status: 404 });
    }

    return Response.json({ school });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load careers branding:", error);
    return Response.json(
      { error: "Unable to load careers branding." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      brandingRoles,
    );

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "A valid request body is required." },
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;
    const action = input.action;

    if (!["save", "publish", "unpublish"].includes(String(action))) {
      return Response.json(
        { error: "Action must be save, publish, or unpublish." },
        { status: 400 },
      );
    }

    if (action === "unpublish") {
      const school = await prisma.$transaction(async (tx) => {
        const updated = await tx.school.update({
          where: { id: schoolId },
          data: {
            careersBrandingPublished: false,
            careersPublishedBranding: Prisma.DbNull,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            ...brandingSelect,
          },
        });

        await createAuditLog(
          tx,
          {
            actorId: authorization.userId,
            schoolId,
            action: "SCHOOL_CAREERS_BRANDING_UNPUBLISHED",
            resourceType: "School",
            resourceId: schoolId,
            metadata: { published: false },
          },
          request,
        );

        return updated;
      });

      return Response.json({ school });
    }

    const parsed = parseBranding(input);
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const branding = parsed.data;
    const publishing = action === "publish";

    const school = await prisma.$transaction(async (tx) => {
      const updated = await tx.school.update({
        where: { id: schoolId },
        data: {
          ...branding,
          ...(publishing
            ? {
                careersBrandingPublished: true,
                careersPublishedBranding: branding,
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          ...brandingSelect,
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: publishing
            ? "SCHOOL_CAREERS_BRANDING_PUBLISHED"
            : "SCHOOL_CAREERS_BRANDING_UPDATED",
          resourceType: "School",
          resourceId: schoolId,
          metadata: {
            published: publishing,
            hasMotto: Boolean(branding.careersMotto),
            valuesCount: branding.careersValues.length,
            hasLogo: Boolean(branding.careersLogoUrl),
            hasCoverImage: Boolean(branding.careersCoverImageUrl),
          },
        },
        request,
      );

      return updated;
    });

    return Response.json({ school });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to update careers branding:", error);
    return Response.json(
      { error: "Unable to update careers branding." },
      { status: 500 },
    );
  }
}
