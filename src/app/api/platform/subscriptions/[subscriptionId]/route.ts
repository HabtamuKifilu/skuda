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

type RouteContext = {
  params: Promise<{
    subscriptionId: string;
  }>;
};

const updateSubscriptionSchema = z.object({
  status: z.nativeEnum(SubscriptionStatus),
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

const allowedTransitions: Record<
  SubscriptionStatus,
  SubscriptionStatus[]
> = {
  [SubscriptionStatus.TRIALING]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.PAUSED,
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.EXPIRED,
  ],
  [SubscriptionStatus.ACTIVE]: [
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.PAUSED,
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.EXPIRED,
  ],
  [SubscriptionStatus.PAST_DUE]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.PAUSED,
    SubscriptionStatus.CANCELED,
    SubscriptionStatus.EXPIRED,
  ],
  [SubscriptionStatus.PAUSED]: [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELED,
  ],
  [SubscriptionStatus.CANCELED]: [],
  [SubscriptionStatus.EXPIRED]: [],
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const { subscriptionId } = await context.params;

    const subscription = await prisma.subscription.findUnique({
      where: {
        id: subscriptionId,
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
          },
        },
        plan: {
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
          },
        },
        invoices: {
          orderBy: {
            issuedAt: "desc",
          },
          take: 10,
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amount: true,
            currency: true,
            periodStart: true,
            periodEnd: true,
            issuedAt: true,
            dueAt: true,
            paidAt: true,
            _count: {
              select: {
                payments: true,
              },
            },
          },
        },
        _count: {
          select: {
            invoices: true,
          },
        },
      },
    });

    if (!subscription) {
      return Response.json(
        { error: "Subscription not found." },
        { status: 404 },
      );
    }

    return Response.json({ subscription });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Failed to get subscription:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const { subscriptionId } = await context.params;

    const body = await request.json();
    const parsed = updateSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid subscription data",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const nextStatus = parsed.data.status;

    const result = await prisma.$transaction(
      async (tx) => {
        const current = await tx.subscription.findUnique({
          where: {
            id: subscriptionId,
          },
          select: {
            id: true,
            status: true,
            billingCycle: true,
            schoolId: true,
            planId: true,
            trialEndsAt: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            canceledAt: true,
          },
        });

        if (!current) {
          throw new Error("SUBSCRIPTION_NOT_FOUND");
        }

        if (current.status === nextStatus) {
          return current;
        }

        if (!allowedTransitions[current.status].includes(nextStatus)) {
          throw new Error(
            `SUBSCRIPTION_INVALID_TRANSITION:${current.status}:${nextStatus}`,
          );
        }

        if (
          nextStatus === SubscriptionStatus.ACTIVE &&
          current.status !== SubscriptionStatus.TRIALING
        ) {
          const existingLiveSubscription =
            await tx.subscription.findFirst({
              where: {
                schoolId: current.schoolId,
                id: {
                  not: current.id,
                },
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

        const now = new Date();

        const data: Prisma.SubscriptionUpdateInput = {
          status: nextStatus,
        };

        if (nextStatus === SubscriptionStatus.CANCELED) {
          data.canceledAt = now;
        }

        if (
          nextStatus === SubscriptionStatus.ACTIVE &&
          current.status !== SubscriptionStatus.ACTIVE
        ) {
          data.currentPeriodStart = now;
          data.currentPeriodEnd = addBillingPeriod(
            now,
            current.billingCycle,
          );
          data.trialEndsAt = null;
          data.canceledAt = null;
        }

        if (nextStatus === SubscriptionStatus.PAUSED) {
          data.canceledAt = null;
        }

        if (nextStatus === SubscriptionStatus.PAST_DUE) {
          data.canceledAt = null;
        }

        if (nextStatus === SubscriptionStatus.EXPIRED) {
          data.canceledAt = null;
        }

        return tx.subscription.update({
          where: {
            id: current.id,
          },
          data,
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
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return Response.json({ subscription: result });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    if (error instanceof Error) {
      if (error.message === "SUBSCRIPTION_NOT_FOUND") {
        return Response.json(
          { error: "Subscription not found." },
          { status: 404 },
        );
      }

      if (error.message.startsWith("SUBSCRIPTION_INVALID_TRANSITION:")) {
        const [, from, to] = error.message.split(":");

        return Response.json(
          {
            error: `Cannot transition subscription from ${from} to ${to}.`,
          },
          { status: 409 },
        );
      }

      if (error.message.startsWith("SUBSCRIPTION_ALREADY_LIVE:")) {
        const [, existingSubscriptionId, status] =
          error.message.split(":");

        return Response.json(
          {
            error:
              "The school already has another active or trialing subscription.",
            subscriptionId: existingSubscriptionId,
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
            "The subscription could not be updated because another commercial operation occurred concurrently. Please try again.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to update subscription:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
