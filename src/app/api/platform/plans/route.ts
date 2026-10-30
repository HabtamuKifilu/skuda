import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { PlatformMembershipRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { platformAuthorizationErrorResponse } from "@/lib/platform-api-errors";
import { requirePlatformRole } from "@/lib/platform-authorization";

const decimalString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid monetary amount.");

const createPlanSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug may contain lowercase letters, numbers, and hyphens.",
    ),
  description: z.string().trim().max(500).optional(),
  currency: z.string().trim().length(3).default("ETB"),
  monthlyPrice: decimalString,
  annualPrice: decimalString,
  maxStudents: z.number().int().positive().nullable().optional(),
  maxStaff: z.number().int().positive().nullable().optional(),
  maxAdmins: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const plans = await prisma.plan.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        currency: true,
        monthlyPrice: true,
        annualPrice: true,
        maxStudents: true,
        maxStaff: true,
        maxAdmins: true,
        isActive: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    return Response.json({ plans });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Failed to list platform plans:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const body = await request.json();
    const parsed = createPlanSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid plan data",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const plan = await prisma.plan.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        currency: data.currency.toUpperCase(),
        monthlyPrice: new Prisma.Decimal(data.monthlyPrice),
        annualPrice: new Prisma.Decimal(data.annualPrice),
        maxStudents: data.maxStudents ?? null,
        maxStaff: data.maxStaff ?? null,
        maxAdmins: data.maxAdmins ?? null,
        isActive: data.isActive,
        isPublic: data.isPublic,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        currency: true,
        monthlyPrice: true,
        annualPrice: true,
        maxStudents: true,
        maxStaff: true,
        maxAdmins: true,
        isActive: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({ plan }, { status: 201 });
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
          error: "A plan with the same slug already exists.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to create platform plan:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
