import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import {
  InvoiceStatus,
  PaymentStatus,
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

const createPaymentSchema = z.object({
  amount: z.coerce.number().finite().positive(),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.SUCCEEDED),
  paymentMethod: z.string().trim().max(100).optional(),
  externalReference: z.string().trim().max(200).optional(),
});

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const { invoiceId } = await context.params;

    const body = await request.json();
    const parsed = createPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid payment data.",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { amount, status, paymentMethod, externalReference } =
      parsed.data;

    const result = await prisma.$transaction(
      async (tx) => {
        const invoice = await tx.invoice.findUnique({
          where: {
            id: invoiceId,
          },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amount: true,
            currency: true,
            paidAt: true,
            school: {
              select: {
                id: true,
                name: true,
                isActive: true,
                currency: true,
              },
            },
            subscription: {
              select: {
                id: true,
                status: true,
                plan: {
                  select: {
                    id: true,
                    name: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        });

        if (!invoice) {
          throw new Error("INVOICE_NOT_FOUND");
        }

        if (
          invoice.status === InvoiceStatus.PAID ||
          invoice.status === InvoiceStatus.VOID ||
          invoice.status === InvoiceStatus.UNCOLLECTIBLE
        ) {
          throw new Error(
            `INVOICE_NOT_PAYABLE:${invoice.status}`,
          );
        }

        if (!invoice.school.isActive) {
          throw new Error("SCHOOL_INACTIVE");
        }

        if (!invoice.subscription.plan.isActive) {
          throw new Error("PLAN_INACTIVE");
        }

        if (invoice.school.currency !== invoice.currency) {
          throw new Error("INVOICE_CURRENCY_MISMATCH");
        }

        const successfulPayments = await tx.payment.aggregate({
          where: {
            invoiceId: invoice.id,
            status: PaymentStatus.SUCCEEDED,
          },
          _sum: {
            amount: true,
          },
        });

        const settledAmount = Number(
          successfulPayments._sum.amount ?? 0,
        );

        const outstandingAmount =
          Number(invoice.amount) - settledAmount;

        if (outstandingAmount <= 0) {
          throw new Error("INVOICE_ALREADY_SETTLED");
        }

        if (amount > outstandingAmount) {
          throw new Error("PAYMENT_EXCEEDS_OUTSTANDING");
        }

        const now = new Date();

        const payment = await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: new Prisma.Decimal(amount.toFixed(2)),
            currency: invoice.currency,
            status,
            paymentMethod: paymentMethod || null,
            externalReference: externalReference || null,
            paidAt:
              status === PaymentStatus.SUCCEEDED ? now : null,
          },
          select: {
            id: true,
            invoiceId: true,
            amount: true,
            currency: true,
            status: true,
            paymentMethod: true,
            externalReference: true,
            paidAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        let invoiceStatus: InvoiceStatus = invoice.status;
        let invoicePaidAt = invoice.paidAt;

        if (status === PaymentStatus.SUCCEEDED) {
          const newSettledAmount = settledAmount + amount;

          if (newSettledAmount >= Number(invoice.amount)) {
            invoiceStatus = InvoiceStatus.PAID;
            invoicePaidAt = now;
          }
        }

        if (
          invoiceStatus !== invoice.status ||
          invoicePaidAt?.getTime() !== invoice.paidAt?.getTime()
        ) {
          await tx.invoice.update({
            where: {
              id: invoice.id,
            },
            data: {
              status: invoiceStatus,
              paidAt: invoicePaidAt,
            },
          });
        }

        const updatedInvoice = await tx.invoice.findUnique({
          where: {
            id: invoice.id,
          },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            amount: true,
            currency: true,
            paidAt: true,
            _count: {
              select: {
                payments: true,
              },
            },
          },
        });

        return {
          payment,
          invoice: updatedInvoice,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return Response.json(
      {
        payment: result.payment,
        invoice: result.invoice,
      },
      { status: 201 },
    );
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

      if (error.message.startsWith("INVOICE_NOT_PAYABLE:")) {
        const status = error.message.split(":")[1];

        return Response.json(
          {
            error: `This invoice cannot accept payments because it is ${status.toLowerCase().replace(/_/g, " ")}.`,
          },
          { status: 409 },
        );
      }

      if (error.message === "SCHOOL_INACTIVE") {
        return Response.json(
          {
            error:
              "Payments cannot be recorded because the school is inactive.",
          },
          { status: 409 },
        );
      }

      if (error.message === "PLAN_INACTIVE") {
        return Response.json(
          {
            error:
              "Payments cannot be recorded because the subscription plan is inactive.",
          },
          { status: 409 },
        );
      }

      if (error.message === "INVOICE_CURRENCY_MISMATCH") {
        return Response.json(
          {
            error:
              "The invoice currency does not match the school's currency.",
          },
          { status: 409 },
        );
      }

      if (error.message === "INVOICE_ALREADY_SETTLED") {
        return Response.json(
          {
            error: "This invoice is already fully settled.",
          },
          { status: 409 },
        );
      }

      if (error.message === "PAYMENT_EXCEEDS_OUTSTANDING") {
        return Response.json(
          {
            error:
              "Payment amount cannot exceed the invoice's outstanding balance.",
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
            "The payment could not be recorded because another commercial operation occurred concurrently. Please try again.",
        },
        { status: 409 },
      );
    }

    console.error("Failed to create payment:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
