import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { platformAuthorizationErrorResponse } from "@/lib/platform-api-errors";
import { requirePlatformRole } from "@/lib/platform-authorization";
import { PlatformMembershipRole } from "@/generated/prisma/enums";
import { createAuditLog } from "@/lib/audit-log";

const createSchoolSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(1).max(50).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().min(2).max(100).default("Ethiopia"),
  timezone: z.string().trim().min(1).max(100).default("Africa/Addis_Ababa"),
  currency: z.string().trim().length(3).default("ETB"),
});

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function createUniqueSlug(name: string) {
  const baseSlug = slugify(name) || "school";

  const existing = await prisma.school.findMany({
    where: {
      slug: {
        startsWith: baseSlug,
      },
    },
    select: {
      slug: true,
    },
  });

  const existingSlugs = new Set(existing.map((school) => school.slug));

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;

  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const body = await request.json();
    const parsed = createSchoolSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid school data",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const school = await prisma.$transaction(async (tx) => {
      const createdSchool = await tx.school.create({
        data: {
          name: data.name,
          slug: await createUniqueSlug(data.name),
          code: data.code || null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          city: data.city || null,
          country: data.country,
          timezone: data.timezone,
          currency: data.currency.toUpperCase(),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          code: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          country: true,
          timezone: true,
          currency: true,
          isActive: true,
          createdAt: true,
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId: createdSchool.id,
        action: "SCHOOL_CREATED",
        resourceType: "School",
        resourceId: createdSchool.id,
        metadata: {
          name: createdSchool.name,
          slug: createdSchool.slug,
          code: createdSchool.code,
        },
      }, request);

      return createdSchool;
    });

    return Response.json({ school }, { status: 201 });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        {
          error: "A school with the same unique identifier already exists.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to create school:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const schools = await prisma.school.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        email: true,
        phone: true,
        city: true,
        country: true,
        timezone: true,
        currency: true,
        isActive: true,
        createdAt: true,
      },
    });

    return Response.json({ schools });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Failed to list schools:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
