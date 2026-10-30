import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { platformAuthorizationErrorResponse } from "@/lib/platform-api-errors";
import { requirePlatformRole } from "@/lib/platform-authorization";
import { PlatformMembershipRole } from "@/generated/prisma/enums";

const updateSchoolSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().min(1).max(50).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().min(2).max(100),
  timezone: z.string().trim().min(1).max(100),
  currency: z.string().trim().length(3),
});

type RouteContext = {
  params: Promise<{
    schoolId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const { schoolId } = await params;

    const body = await request.json();
    const parsed = updateSchoolSchema.safeParse(body);

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

    const existingSchool = await prisma.school.findUnique({
      where: {
        id: schoolId,
      },
      select: {
        id: true,
      },
    });

    if (!existingSchool) {
      return Response.json(
        { error: "School not found" },
        { status: 404 },
      );
    }

    const school = await prisma.school.update({
      where: {
        id: schoolId,
      },
      data: {
        name: data.name,
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
        updatedAt: true,
      },
    });

    return Response.json({ school });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return Response.json(
        { error: "School not found" },
        { status: 404 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        {
          error: "A school with the same unique code already exists.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to update school:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
