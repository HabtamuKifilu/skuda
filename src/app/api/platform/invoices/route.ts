import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import {
  InvoiceStatus,
  PlatformMembershipRole,
  SubscriptionStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { platformAuthorizationErrorResponse } from "@/lib/platform-api-errors";
import { requirePlatformRole } from "@/lib/platform-authorization";

const createInvoiceSchema = z.object({
  subscriptionId: z.string().trim().min(1),
});

function createInvoiceNumber(date: Date) {
  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/-/g, "");

  const uniquePart = randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();

  return `INV-${datePart}-${uniquePart}`;
}

export async function GET(request: NextRequest) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim() ?? "";
    const statusParam = searchParams.get("status")?.trim() ?? "";

    const requestedPage = Number.parseInt(
      searchParams.get("page") ?? "1",
      10,
    );

    const page =
      Number.isFinite(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const pageSize = 10;

    const status = Object.values(InvoiceStatus).includes(
      statusParam as InvoiceStatus,
    )
      ? (statusParam as InvoiceStatus)
      : undefined;

    const where: Prisma.InvoiceWhereInput = {
      ...(q
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: q,
                  mode: "insensitive",
                },
              },
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
                subscription: {
                  plan: {
                    name: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
    };

    const skip = (page - 1) * pageSize;

    const [
      invoices,
      filteredTotal,
      totalCount,
      issuedCount,
      paidCount,
      pastDueCount,
    ] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        orderBy: {
          issuedAt: "desc",
        },
        skip,
        take: pageSize,
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
          school: {
            select: {
              id: true,
              name: true,
              code: true,
              city: true,
              country: true,
              isActive: true,
            },
          },
          subscription: {
            select: {
              id: true,
              status: true,
              billingCycle: true,
              plan: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          payments: {
            where: {
              status: "SUCCEEDED",
            },
            select: {
              amount: true,
            },
          },
          _count: {
            select: {
              payments: true,
            },
          },
        },
      }),
      prisma.invoice.count({
        where,
      }),
      prisma.invoice.count(),
      prisma.invoice.count({
        where: {
          status: InvoiceStatus.ISSUED,
        },
      }),
      prisma.invoice.count({
        where: {
          status: InvoiceStatus.PAID,
        },
      }),
      prisma.invoice.count({
        where: {
          status: InvoiceStatus.PAST_DUE,
        },
      }),
    ]);

    const invoicesWithSettlement = invoices.map((invoice) => {
      const successfulPaymentTotal = invoice.payments.reduce(
        (total, payment) => total + Number(payment.amount),
        0,
      );

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        amount: invoice.amount,
        currency: invoice.currency,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        issuedAt: invoice.issuedAt,
        dueAt: invoice.dueAt,
        paidAt: invoice.paidAt,
        school: invoice.school,
        subscription: invoice.subscription,
        _count: invoice._count,
        successfulPaymentTotal,
      };
    });

    const totalPages = Math.max(
      1,
      Math.ceil(filteredTotal / pageSize),
    );

    return Response.json({
      invoices: invoicesWithSettlement,
      pagination: {
        page,
        pageSize,
        total: filteredTotal,
        totalPages,
      },
      counts: {
        total: totalCount,
        issued: issuedCount,
        paid: paidCount,
        pastDue: pastDueCount,
      },
    });
  } catch (error) {
    const authorizationResponse = platformAuthorizationErrorResponse(error);

    if (authorizationResponse) {
      return authorizationResponse;
    }

    console.error("Failed to fetch invoices:", error);

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
    const parsed = createInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid invoice data",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { subscriptionId } = parsed.data;

    const invoice = await prisma.$transaction(
      async (tx) => {
        const subscription = await tx.subscription.findUnique({
          where: {
            id: subscriptionId,
          },
          select: {
            id: true,
            status: true,
            billingCycle: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            school: {
              select: {
                id: true,
                name: true,
                currency: true,
                isActive: true,
              },
            },
            plan: {
              select: {
                id: true,
                name: true,
                currency: true,
                monthlyPrice: true,
                annualPrice: true,
                isActive: true,
              },
            },
          },
        });

        if (!subscription) {
          throw new Error("INVOICE_SUBSCRIPTION_NOT_FOUND");
        }

        if (subscription.status !== SubscriptionStatus.ACTIVE) {
          throw new Error(
            `INVOICE_SUBSCRIPTION_NOT_ACTIVE:${subscription.status}`,
          );
        }

        if (!subscription.school.isActive) {
          throw new Error("INVOICE_SCHOOL_INACTIVE");
        }

        if (!subscription.plan.isActive) {
          throw new Error("INVOICE_PLAN_INACTIVE");
        }

        if (
          subscription.school.currency !== subscription.plan.currency
        ) {
          throw new Error("INVOICE_CURRENCY_MISMATCH");
        }

        const existingInvoice = await tx.invoice.findFirst({
          where: {
            subscriptionId: subscription.id,
            periodStart: subscription.currentPeriodStart,
            periodEnd: subscription.currentPeriodEnd,
            status: {
              not: InvoiceStatus.VOID,
            },
          },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
          },
        });

        if (existingInvoice) {
          throw new Error(
            `INVOICE_ALREADY_EXISTS:${existingInvoice.id}:${existingInvoice.invoiceNumber}`,
          );
        }

        const amount =
          subscription.billingCycle === "MONTHLY"
            ? subscription.plan.monthlyPrice
            : subscription.plan.annualPrice;

        const issuedAt = new Date();

        return tx.invoice.create({
          data: {
            schoolId: subscription.school.id,
            subscriptionId: subscription.id,
            invoiceNumber: createInvoiceNumber(issuedAt),
            status: InvoiceStatus.ISSUED,
            amount,
            currency: subscription.school.currency,
            periodStart: subscription.currentPeriodStart,
            periodEnd: subscription.currentPeriodEnd,
            issuedAt,
            dueAt: issuedAt,
          },
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
            createdAt: true,
            updatedAt: true,
            school: {
              select: {
                id: true,
                name: true,
                code: true,
                currency: true,
                isActive: true,
              },
            },
            subscription: {
              select: {
                id: true,
                status: true,
                billingCycle: true,
                currentPeriodStart: true,
                currentPeriodEnd: true,
              },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return Response.json({ invoice }, { status: 201 });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    if (error instanceof Error) {
      if (error.message === "INVOICE_SUBSCRIPTION_NOT_FOUND") {
        return Response.json(
          { error: "Subscription not found." },
          { status: 404 },
        );
      }

      if (error.message.startsWith("INVOICE_SUBSCRIPTION_NOT_ACTIVE:")) {
        const [, status] = error.message.split(":");

        return Response.json(
          {
            error: `Invoices can only be generated for active subscriptions. Current status: ${status}.`,
          },
          { status: 400 },
        );
      }

      if (error.message === "INVOICE_SCHOOL_INACTIVE") {
        return Response.json(
          { error: "The subscription school is inactive." },
          { status: 400 },
        );
      }

      if (error.message === "INVOICE_PLAN_INACTIVE") {
        return Response.json(
          { error: "The subscription plan is inactive." },
          { status: 400 },
        );
      }

      if (error.message === "INVOICE_CURRENCY_MISMATCH") {
        return Response.json(
          {
            error:
              "The school currency does not match the subscription plan currency.",
          },
          { status: 400 },
        );
      }

      if (error.message.startsWith("INVOICE_ALREADY_EXISTS:")) {
        const [, invoiceId, invoiceNumber] =
          error.message.split(":");

        return Response.json(
          {
            error:
              "An invoice already exists for the subscription's current billing period.",
            invoiceId,
            invoiceNumber,
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
            "The invoice could not be created because another commercial operation occurred concurrently. Please try again.",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        {
          error:
            "The invoice could not be created because the generated invoice number already exists. Please try again.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to create invoice:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
