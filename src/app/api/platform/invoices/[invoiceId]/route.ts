import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import {
  InvoiceStatus,
  PlatformMembershipRole,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { platformAuthorizationErrorResponse } from "@/lib/platform-api-errors";
import { requirePlatformRole } from "@/lib/platform-authorization";

type RouteContext = {
  params: Promise<{
    invoiceId: string;
  }>;
};

const updateInvoiceSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
});

const allowedTransitions: Record<
  InvoiceStatus,
  InvoiceStatus[]
> = {
  [InvoiceStatus.DRAFT]: [
    InvoiceStatus.ISSUED,
    InvoiceStatus.VOID,
  ],
  [InvoiceStatus.ISSUED]: [
    InvoiceStatus.PAST_DUE,
    InvoiceStatus.VOID,
    InvoiceStatus.UNCOLLECTIBLE,
  ],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.PAST_DUE]: [
    InvoiceStatus.VOID,
    InvoiceStatus.UNCOLLECTIBLE,
  ],
  [InvoiceStatus.VOID]: [],
  [InvoiceStatus.UNCOLLECTIBLE]: [],
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const { invoiceId } = await context.params;

    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
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
        subscription: {
          select: {
            id: true,
            status: true,
            billingCycle: true,
            startDate: true,
            trialEndsAt: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
            canceledAt: true,
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
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            paymentMethod: true,
            externalReference: true,
            paidAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    if (!invoice) {
      return Response.json(
        { error: "Invoice not found." },
        { status: 404 },
      );
    }

    return Response.json({ invoice });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Failed to get invoice:", error);

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

    const { invoiceId } = await context.params;

    const body = await request.json();
    const parsed = updateInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid invoice data",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const nextStatus = parsed.data.status;

    const result = await prisma.$transaction(
      async (tx) => {
        const current = await tx.invoice.findUnique({
          where: {
            id: invoiceId,
          },
          select: {
            id: true,
            status: true,
            paidAt: true,
            amount: true,
            currency: true,
            schoolId: true,
            subscriptionId: true,
          },
        });

        if (!current) {
          throw new Error("INVOICE_NOT_FOUND");
        }

        if (current.status === nextStatus) {
          return tx.invoice.findUnique({
            where: {
              id: current.id,
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
                  city: true,
                  country: true,
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
              },
              _count: {
                select: {
                  payments: true,
                },
              },
            },
          });
        }

        if (!allowedTransitions[current.status].includes(nextStatus)) {
          throw new Error(
            `INVOICE_INVALID_TRANSITION:${current.status}:${nextStatus}`,
          );
        }

        if (nextStatus === InvoiceStatus.PAID) {
          throw new Error("INVOICE_PAYMENT_REQUIRED");
        }

        if (
          nextStatus === InvoiceStatus.VOID &&
          current.status === InvoiceStatus.PAID
        ) {
          throw new Error("INVOICE_PAID_TERMINAL");
        }

        const data: Prisma.InvoiceUpdateInput = {
          status: nextStatus,
        };

        if (nextStatus === InvoiceStatus.VOID) {
          data.paidAt = null;
        }

        if (nextStatus === InvoiceStatus.UNCOLLECTIBLE) {
          data.paidAt = null;
        }

        return tx.invoice.update({
          where: {
            id: current.id,
          },
          data,
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
                city: true,
                country: true,
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
            },
            _count: {
              select: {
                payments: true,
              },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return Response.json({ invoice: result });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    if (error instanceof Error) {
      if (error.message === "INVOICE_NOT_FOUND") {
        return Response.json(
          { error: "Invoice not found." },
          { status: 404 },
        );
      }

      if (error.message === "INVOICE_PAYMENT_REQUIRED") {
        return Response.json(
          {
            error:
              "An invoice can only become paid through a successful payment.",
          },
          { status: 409 },
        );
      }

      if (error.message === "INVOICE_PAID_TERMINAL") {
        return Response.json(
          {
            error:
              "A paid invoice cannot be changed through the invoice lifecycle.",
          },
          { status: 409 },
        );
      }

      if (error.message.startsWith("INVOICE_INVALID_TRANSITION:")) {
        const [, from, to] = error.message.split(":");

        return Response.json(
          {
            error: `Cannot transition invoice from ${from} to ${to}.`,
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
            "The invoice could not be updated because another commercial operation occurred concurrently. Please try again.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to update invoice:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
