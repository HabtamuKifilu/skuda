import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Receipt,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { notFound } from "next/navigation";
import { InvoiceStatus, SubscriptionStatus } from "@/generated/prisma/enums";
import { InvoiceLifecycle } from "@/components/platform-billing/invoice-lifecycle";
import { RecordPaymentForm } from "@/components/platform-billing/record-payment-form";
import { PlatformPageLayout } from "@/components/platform-shell/platform-page";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

type RouteContext = {
  params: Promise<{
    invoiceId: string;
  }>;
};

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateOnly(date: Date | null | undefined) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

function formatAmount(amount: unknown, currency: string) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return "—";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function invoiceStatusClass(status: InvoiceStatus) {
  switch (status) {
    case InvoiceStatus.PAID:
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case InvoiceStatus.ISSUED:
      return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400";
    case InvoiceStatus.PAST_DUE:
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case InvoiceStatus.UNCOLLECTIBLE:
      return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400";
    default:
      return "border-border bg-muted/50 text-muted-foreground";
  }
}

function InvoiceStatusBadge({
  status,
}: {
  status: InvoiceStatus;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${invoiceStatusClass(status)}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {formatEnum(status)}
    </span>
  );
}

function subscriptionStatusClass(status: SubscriptionStatus) {
  switch (status) {
    case SubscriptionStatus.ACTIVE:
      return "text-emerald-700 dark:text-emerald-400";
    case SubscriptionStatus.TRIALING:
      return "text-primary";
    case SubscriptionStatus.PAST_DUE:
      return "text-amber-700 dark:text-amber-400";
    case SubscriptionStatus.CANCELED:
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Receipt;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4.5" strokeWidth={1.8} />
          </div>

          <div>
            <h2 className="text-[13px] font-semibold">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </div>

      {children}
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-border px-5 py-3.5 last:border-b-0">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>

      <dd
        className={`min-w-0 text-right text-xs font-medium ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function PaymentStatusBadge({
  status,
}: {
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
}) {
  const className =
    status === "SUCCEEDED"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : status === "FAILED"
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : status === "REFUNDED"
          ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "border-border bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${className}`}
    >
      {formatEnum(status)}
    </span>
  );
}

export default async function PlatformInvoiceDetailsPage({
  params,
}: RouteContext) {
  await requirePlatformOwnerPage();

  const { invoiceId } = await params;

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
          createdAt: true,
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
    notFound();
  }

  const liveSubscription =
    invoice.subscription.status === SubscriptionStatus.ACTIVE ||
    invoice.subscription.status === SubscriptionStatus.TRIALING;

  const planPrice =
    invoice.subscription.billingCycle === "MONTHLY"
      ? invoice.subscription.plan.monthlyPrice
      : invoice.subscription.plan.annualPrice;

  const successfulPayments = invoice.payments.filter(
    (payment) => payment.status === "SUCCEEDED",
  );

  const successfulPaymentTotal = successfulPayments.reduce(
    (total, payment) => total + Number(payment.amount),
    0,
  );

  const outstandingAmount = Math.max(
    0,
    Number(invoice.amount) - successfulPaymentTotal,
  );

  return (
    <PlatformShell>
      <PlatformPageLayout>
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="size-6" strokeWidth={1.7} />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">
                      {invoice.invoiceNumber}
                    </h1>

                    <InvoiceStatusBadge status={invoice.status} />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                    <span>{invoice.school.name}</span>

                    <span className="text-border">•</span>

                    <span>{invoice.subscription.plan.name}</span>

                    <span className="text-border">•</span>

                    <span>
                      {invoice.subscription.billingCycle === "MONTHLY"
                        ? "Monthly"
                        : "Annual"}
                    </span>

                    <span className="text-border">•</span>

                    <span>
                      Issued {formatDateOnly(invoice.issuedAt)}
                    </span>
                  </div>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                    Commercial invoice for the{" "}
                    {invoice.subscription.plan.name} subscription at{" "}
                    {invoice.school.name}.
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <InvoiceLifecycle
                  invoiceId={invoice.id}
                  currentStatus={invoice.status}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
          <div className="min-w-0 space-y-5">
            <Section
              icon={CircleDollarSign}
              title="Invoice summary"
              description="Commercial amount, billing period, and settlement position."
            >
              <div className="grid gap-px bg-border sm:grid-cols-3">
                <div className="bg-card px-5 py-5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Invoice amount
                  </p>

                  <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
                    {formatAmount(invoice.amount, invoice.currency)}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {invoice.currency}
                  </p>
                </div>

                <div className="bg-card px-5 py-5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Settled
                  </p>

                  <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
                    {formatAmount(
                      successfulPaymentTotal,
                      invoice.currency,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {successfulPayments.length} successful payment
                    {successfulPayments.length === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="bg-card px-5 py-5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Outstanding
                  </p>

                  <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">
                    {formatAmount(outstandingAmount, invoice.currency)}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Current settlement balance
                  </p>
                </div>
              </div>

              <dl>
                <DetailRow
                  label="Billing period"
                  value={
                    <span>
                      {formatDate(invoice.periodStart)}{" "}
                      <span className="text-muted-foreground">to</span>{" "}
                      {formatDate(invoice.periodEnd)}
                    </span>
                  }
                />

                <DetailRow
                  label="Issued"
                  value={formatDate(invoice.issuedAt)}
                />

                <DetailRow
                  label="Due"
                  value={formatDate(invoice.dueAt)}
                />

                <DetailRow
                  label="Paid"
                  value={formatDate(invoice.paidAt)}
                />

                <DetailRow
                  label="Invoice ID"
                  value={invoice.id}
                  mono
                />
              </dl>
            </Section>

            <Section
              icon={CreditCard}
              title="Payment activity"
              description="Recorded settlement attempts and payment outcomes for this invoice."
            >
              <RecordPaymentForm
                invoiceId={invoice.id}
                currency={invoice.currency}
                outstandingAmount={outstandingAmount}
                disabled={invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.UNCOLLECTIBLE}
              />
              {invoice.payments.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground">
                    <CreditCard className="size-5" />
                  </div>

                  <h3 className="mt-4 text-sm font-semibold">
                    No payments recorded
                  </h3>

                  <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-muted-foreground">
                    Payment activity will appear here when a settlement is
                    recorded against this invoice.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="px-5 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums">
                              {formatAmount(
                                payment.amount,
                                payment.currency,
                              )}
                            </span>

                            <PaymentStatusBadge
                              status={payment.status}
                            />
                          </div>

                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span>
                              {payment.paymentMethod ||
                                "Payment method not specified"}
                            </span>

                            {payment.externalReference ? (
                              <>
                                <span className="text-border">•</span>
                                <span className="font-mono">
                                  {payment.externalReference}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="shrink-0 text-left sm:text-right">
                          <p className="text-xs font-medium">
                            {formatDate(payment.paidAt || payment.createdAt)}
                          </p>

                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Recorded {formatDate(payment.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              icon={CalendarDays}
              title="Subscription period"
              description="The subscription period from which this invoice was generated."
            >
              <dl>
                <DetailRow
                  label="Subscription"
                  value={invoice.subscription.id}
                  mono
                />

                <DetailRow
                  label="Billing cycle"
                  value={
                    invoice.subscription.billingCycle === "MONTHLY"
                      ? "Monthly"
                      : "Annual"
                  }
                />

                <DetailRow
                  label="Subscription start"
                  value={formatDate(invoice.subscription.startDate)}
                />

                <DetailRow
                  label="Current period"
                  value={
                    <span>
                      {formatDate(invoice.subscription.currentPeriodStart)}
                      {" — "}
                      {formatDate(invoice.subscription.currentPeriodEnd)}
                    </span>
                  }
                />

                <DetailRow
                  label="Trial ends"
                  value={formatDate(invoice.subscription.trialEndsAt)}
                />

                <DetailRow
                  label="Canceled"
                  value={formatDate(invoice.subscription.canceledAt)}
                />
              </dl>
            </Section>
          </div>

          <div className="min-w-0 space-y-5">
            <Section
              icon={Building2}
              title="School"
              description="Organization associated with this commercial invoice."
            >
              <dl>
                <DetailRow
                  label="School"
                  value={invoice.school.name}
                />

                <DetailRow
                  label="Code"
                  value={invoice.school.code || "—"}
                  mono={Boolean(invoice.school.code)}
                />

                <DetailRow
                  label="City"
                  value={invoice.school.city || "—"}
                />

                <DetailRow
                  label="Country"
                  value={invoice.school.country}
                />

                <DetailRow
                  label="Currency"
                  value={invoice.school.currency}
                />

                <DetailRow
                  label="Timezone"
                  value={invoice.school.timezone}
                />

                <DetailRow
                  label="Operational state"
                  value={
                    <span
                      className={
                        invoice.school.isActive
                          ? "font-medium text-emerald-700 dark:text-emerald-400"
                          : "font-medium text-destructive"
                      }
                    >
                      {invoice.school.isActive
                        ? "Active"
                        : "Inactive"}
                    </span>
                  }
                />
              </dl>
            </Section>

            <Section
              icon={WalletCards}
              title="Plan"
              description="Commercial plan attached to the invoice subscription."
            >
              <dl>
                <DetailRow
                  label="Plan"
                  value={invoice.subscription.plan.name}
                />

                <DetailRow
                  label="Billing price"
                  value={formatAmount(
                    planPrice,
                    invoice.subscription.plan.currency,
                  )}
                />

                <DetailRow
                  label="Currency"
                  value={invoice.subscription.plan.currency}
                />

                <DetailRow
                  label="Plan state"
                  value={
                    invoice.subscription.plan.isActive
                      ? "Active"
                      : "Inactive"
                  }
                />

                <DetailRow
                  label="Visibility"
                  value={
                    invoice.subscription.plan.isPublic
                      ? "Public"
                      : "Private"
                  }
                />
              </dl>
            </Section>

            <Section
              icon={ShieldCheck}
              title="Commercial record"
              description="Invoice and subscription operational state."
            >
              <dl>
                <DetailRow
                  label="Invoice status"
                  value={<InvoiceStatusBadge status={invoice.status} />}
                />

                <DetailRow
                  label="Subscription status"
                  value={
                    <span
                      className={`font-medium ${subscriptionStatusClass(
                        invoice.subscription.status,
                      )}`}
                    >
                      {formatEnum(invoice.subscription.status)}
                    </span>
                  }
                />

                <DetailRow
                  label="Payment records"
                  value={invoice._count.payments}
                />

                <DetailRow
                  label="Live subscription"
                  value={liveSubscription ? "Yes" : "No"}
                />

                <DetailRow
                  label="Created"
                  value={formatDate(invoice.createdAt)}
                />

                <DetailRow
                  label="Updated"
                  value={formatDate(invoice.updatedAt)}
                />
              </dl>
            </Section>

            <Section
              icon={Clock3}
              title="Timeline"
              description="Key invoice lifecycle timestamps."
            >
              <dl>
                <DetailRow
                  label="Issued"
                  value={formatDate(invoice.issuedAt)}
                />

                <DetailRow
                  label="Due"
                  value={formatDate(invoice.dueAt)}
                />

                <DetailRow
                  label="Paid"
                  value={formatDate(invoice.paidAt)}
                />

                <DetailRow
                  label="Created"
                  value={formatDate(invoice.createdAt)}
                />
              </dl>
            </Section>
          </div>
        </div>
      </PlatformPageLayout>
    </PlatformShell>
  );
}
