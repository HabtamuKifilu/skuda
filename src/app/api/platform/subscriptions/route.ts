import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import {
  PlanBillingCycle,
  PlatformMembershipRole,
  SubscriptionStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { platformAuthorizationErrorResponse } from "@/lib/platform-api-errors";
import { requirePlatformRole } from "@/lib/platform-authorization";

const dateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date.",
  });

const createSubscriptionSchema = z.object({
  schoolId: z.string().trim().min(1),
  planId: z.string().trim().min(1),
  status: z
    .nativeEnum(SubscriptionStatus)
    .default(SubscriptionStatus.ACTIVE),
  billingCycle: z
    .nativeEnum(PlanBillingCycle)
    .default(PlanBillingCycle.MONTHLY),
  startDate: dateSchema,
  trialEndsAt: dateSchema.optional().nullable(),
});

function addBillingPeriod(date: Date, billingCycle: PlanBillingCycle) {
  const result = new Date(date);

  if (billingCycle === PlanBillingCycle.ANNUAL) {
    result.setFullYear(result.getFullYear() + 1);
  } else {
    result.setMonth(result.getMonth() + 1);
  }

  return result;
}

function dateAtStartOfDayInTimeZone(dateValue: string, timeZone: string) {
  const [year, month, day] = dateValue.split("-").map(Number);

  const utcGuess = new Date(Date.UTC(year, month - 1, day));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utcGuess);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  const offset = localAsUtc - utcGuess.getTime();

  return new Date(
    Date.UTC(year, month - 1, day) - offset,
  );
}

export async function GET(request: NextRequest) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim() ?? "";
    const statusParam = searchParams.get("status")?.trim() ?? "";
    const billingCycleParam =
      searchParams.get("billingCycle")?.trim() ?? "";

    const requestedPage = Number.parseInt(
      searchParams.get("page") ?? "1",
      10,
    );

    const page =
      Number.isFinite(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const pageSize = 10;

    const status = Object.values(SubscriptionStatus).includes(
      statusParam as SubscriptionStatus,
    )
      ? (statusParam as SubscriptionStatus)
      : undefined;

    const billingCycle = Object.values(PlanBillingCycle).includes(
      billingCycleParam as PlanBillingCycle,
    )
      ? (billingCycleParam as PlanBillingCycle)
      : undefined;

    const where: Prisma.SubscriptionWhereInput = {
      ...(q
        ? {
            OR: [
              {
                school: {
                  name: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
              {
                school: {
                  code: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
              {
                plan: {
                  name: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
              {
                plan: {
                  slug: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
      ...(billingCycle ? { billingCycle } : {}),
    };

    const [
      subscriptions,
      filteredTotal,
      totalCount,
      activeCount,
      trialingCount,
      pastDueCount,
    ] = await prisma.$transaction([
      prisma.subscription.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          billingCycle: true,
          startDate: true,
          trialEndsAt: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          canceledAt: true,
          createdAt: true,
          updatedAt: true,
          school: {
            select: {
              id: true,
              name: true,
              timezone: true,
              code: true,
              city: true,
              country: true,
              isActive: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              slug: true,
              currency: true,
              monthlyPrice: true,
              annualPrice: true,
              isActive: true,
            },
          },
        },
      }),

      prisma.subscription.count({
        where,
      }),

      prisma.subscription.count(),

      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
        },
      }),

      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.TRIALING,
        },
      }),

      prisma.subscription.count({
        where: {
          status: SubscriptionStatus.PAST_DUE,
        },
      }),
    ]);

    const totalPages = Math.max(
      1,
      Math.ceil(filteredTotal / pageSize),
    );

    return Response.json({
      subscriptions,
      pagination: {
        page,
        pageSize,
        total: filteredTotal,
        totalPages,
      },
      counts: {
        total: totalCount,
        active: activeCount,
        trialing: trialingCount,
        pastDue: pastDueCount,
      },
    });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Failed to list subscriptions:", error);

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
    const parsed = createSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid subscription data",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    if (
      data.status === SubscriptionStatus.TRIALING &&
      !data.trialEndsAt
    ) {
      return Response.json(
        {
          error: "A trial end date is required for a trialing subscription.",
        },
        { status: 400 },
      );
    }

    if (
      data.status !== SubscriptionStatus.TRIALING &&
      data.trialEndsAt
    ) {
      return Response.json(
        {
          error:
            "Trial end date can only be set for a trialing subscription.",
        },
        { status: 400 },
      );
    }

    const subscription = await prisma.$transaction(
      async (tx) => {
        const [school, plan] = await Promise.all([
          tx.school.findUnique({
            where: {
              id: data.schoolId,
            },
            select: {
              id: true,
              name: true,
              timezone: true,
              isActive: true,
              currency: true,
            },
          }),

          tx.plan.findUnique({
            where: {
              id: data.planId,
            },
            select: {
              id: true,
              name: true,
              currency: true,
              isActive: true,
            },
          }),
        ]);

        if (!school) {
          throw new Error("SUBSCRIPTION_SCHOOL_NOT_FOUND");
        }

        if (!school.isActive) {
          throw new Error("SUBSCRIPTION_SCHOOL_INACTIVE");
        }

        if (!plan) {
          throw new Error("SUBSCRIPTION_PLAN_NOT_FOUND");
        }

        if (!plan.isActive) {
          throw new Error("SUBSCRIPTION_PLAN_INACTIVE");
        }

        if (school.currency !== plan.currency) {
          throw new Error("SUBSCRIPTION_CURRENCY_MISMATCH");
        }

        const schoolToday = new Intl.DateTimeFormat("en-CA", {
          timeZone: school.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());

        const startDate =
          data.startDate === schoolToday
            ? new Date()
            : dateAtStartOfDayInTimeZone(
                data.startDate,
                school.timezone,
              );

        const trialEndsAt = data.trialEndsAt
          ? dateAtStartOfDayInTimeZone(
              data.trialEndsAt,
              school.timezone,
            )
          : null;

        if (trialEndsAt && trialEndsAt <= startDate) {
          throw new Error("SUBSCRIPTION_INVALID_TRIAL_END");
        }

        if (
          data.status === SubscriptionStatus.ACTIVE ||
          data.status === SubscriptionStatus.TRIALING
        ) {
          const existingLiveSubscription =
            await tx.subscription.findFirst({
              where: {
                schoolId: data.schoolId,
                status: {
                  in: [
                    SubscriptionStatus.ACTIVE,
                    SubscriptionStatus.TRIALING,
                  ],
                },
              },
              select: {
                id: true,
                status: true,
              },
            });

          if (existingLiveSubscription) {
            throw new Error(
              `SUBSCRIPTION_ALREADY_LIVE:${existingLiveSubscription.id}:${existingLiveSubscription.status}`,
            );
          }
        }

        const currentPeriodStart = startDate;
        const currentPeriodEnd =
          data.status === SubscriptionStatus.TRIALING
            ? trialEndsAt!
            : addBillingPeriod(
                currentPeriodStart,
                data.billingCycle,
              );

        return tx.subscription.create({
          data: {
            schoolId: data.schoolId,
            planId: data.planId,
            status: data.status,
            billingCycle: data.billingCycle,
            startDate,
            trialEndsAt,
            currentPeriodStart,
            currentPeriodEnd,
          },
          select: {
            id: true,
            status: true,
            billingCycle: true,
            startDate: true,
            trialEndsAt: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            canceledAt: true,
            createdAt: true,
            updatedAt: true,
            school: {
              select: {
                id: true,
                name: true,
                code: true,
                city: true,
                country: true,
                currency: true,
              },
            },
            plan: {
              select: {
                id: true,
                name: true,
                slug: true,
                currency: true,
                monthlyPrice: true,
                annualPrice: true,
              },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return Response.json({ subscription }, { status: 201 });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    if (error instanceof Error) {
      if (error.message === "SUBSCRIPTION_SCHOOL_NOT_FOUND") {
        return Response.json(
          { error: "School not found." },
          { status: 404 },
        );
      }

      if (error.message === "SUBSCRIPTION_SCHOOL_INACTIVE") {
        return Response.json(
          { error: "School is inactive." },
          { status: 400 },
        );
      }

      if (error.message === "SUBSCRIPTION_PLAN_NOT_FOUND") {
        return Response.json(
          { error: "Plan not found." },
          { status: 404 },
        );
      }

      if (error.message === "SUBSCRIPTION_PLAN_INACTIVE") {
        return Response.json(
          { error: "Plan is inactive." },
          { status: 400 },
        );
      }

      if (error.message === "SUBSCRIPTION_CURRENCY_MISMATCH") {
        return Response.json(
          {
            error:
              "School currency does not match the selected plan currency.",
          },
          { status: 400 },
        );
      }

      if (error.message === "SUBSCRIPTION_INVALID_TRIAL_END") {
        return Response.json(
          {
            error:
              "Trial end date must be after the subscription start date.",
          },
          { status: 400 },
        );
      }

      if (error.message.startsWith("SUBSCRIPTION_ALREADY_LIVE:")) {
        const [, subscriptionId, status] =
          error.message.split(":");

        return Response.json(
          {
            error: "School already has a live subscription.",
            subscriptionId,
            status,
          },
          { status: 409 },
        );
      }
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return Response.json(
        {
          error:
            "The subscription could not be created because another commercial change occurred at the same time. Please try again.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to create subscription:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

