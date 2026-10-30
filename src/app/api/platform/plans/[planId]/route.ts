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

const updatePlanSchema = z.object({
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
  currency: z.string().trim().length(3),
  monthlyPrice: decimalString,
  annualPrice: decimalString,
  maxStudents: z.number().int().positive().nullable(),
  maxStaff: z.number().int().positive().nullable(),
  maxAdmins: z.number().int().positive().nullable(),
  isActive: z.boolean(),
  isPublic: z.boolean(),
});

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const { planId } = await params;

    const plan = await prisma.plan.findUnique({
      where: {
        id: planId,
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
        subscriptions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
          select: {
            id: true,
            status: true,
            billingCycle: true,
            startDate: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            school: {
              select: {
                id: true,
                name: true,
                code: true,
                city: true,
              },
            },
          },
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      return Response.json(
        { error: "Plan not found" },
        { status: 404 },
      );
    }

    return Response.json({ plan });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Failed to get platform plan:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const { planId } = await params;

    const body = await request.json();
    const parsed = updatePlanSchema.safeParse(body);

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

    const existingPlan = await prisma.plan.findUnique({
      where: {
        id: planId,
      },
      select: {
        id: true,
      },
    });

    if (!existingPlan) {
      return Response.json(
        { error: "Plan not found" },
        { status: 404 },
      );
    }

    const plan = await prisma.plan.update({
      where: {
        id: planId,
      },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        currency: data.currency.toUpperCase(),
        monthlyPrice: new Prisma.Decimal(data.monthlyPrice),
        annualPrice: new Prisma.Decimal(data.annualPrice),
        maxStudents: data.maxStudents,
        maxStaff: data.maxStaff,
        maxAdmins: data.maxAdmins,
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

    return Response.json({ plan });
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
        { error: "Plan not found" },
        { status: 404 },
      );
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

    console.error("Failed to update platform plan:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
