import {
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  PauseCircle,
  Receipt,
  ShieldCheck,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { PlatformPageLayout } from "@/components/platform-shell/platform-page";
import Link from "next/link";
import { SubscriptionLifecycle } from "@/components/platform-subscriptions/subscription-lifecycle";
import { GenerateInvoiceButton } from "@/components/platform-billing/generate-invoice-button";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";
import {
  InvoiceStatus,
  SubscriptionStatus,
} from "@/generated/prisma/enums";

type RouteContext = {
  params: Promise<{
    subscriptionId: string;
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

function formatPrice(amount: unknown, currency: string) {
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

function statusTone(status: SubscriptionStatus) {
  switch (status) {
    case SubscriptionStatus.ACTIVE:
      return "active";
    case SubscriptionStatus.TRIALING:
      return "trialing";
    case SubscriptionStatus.PAST_DUE:
      return "warning";
    case SubscriptionStatus.PAUSED:
      return "paused";
    case SubscriptionStatus.CANCELED:
      return "danger";
    case SubscriptionStatus.EXPIRED:
      return "muted";
    default:
      return "muted";
  }
}

function SubscriptionStatusBadge({
  status,
}: {
  status: SubscriptionStatus;
}) {
  const tone = statusTone(status);

  const className =
    tone === "active"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : tone === "trialing"
        ? "border-primary/15 bg-primary/5 text-primary"
        : tone === "warning"
          ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : tone === "paused"
            ? "border-border bg-muted/50 text-muted-foreground"
            : tone === "danger"
              ? "border-destructive/20 bg-destructive/10 text-destructive"
              : "border-border bg-muted/50 text-muted-foreground";

  const dotClass =
    tone === "active"
      ? "bg-emerald-500"
      : tone === "trialing"
        ? "bg-primary"
        : tone === "warning"
          ? "bg-amber-500"
          : tone === "danger"
            ? "bg-destructive"
            : "bg-muted-foreground/50";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}
    >
      <span className={`size-1.5 rounded-full ${dotClass}`} />
      {formatEnum(status)}
    </span>
  );
}

function InvoiceStatusBadge({
  status,
}: {
  status: InvoiceStatus;
}) {
  const positive =
    status === InvoiceStatus.PAID ||
    status === InvoiceStatus.ISSUED;

  const negative =
    status === InvoiceStatus.VOID ||
    status === InvoiceStatus.UNCOLLECTIBLE;

  const className = positive
    ? status === InvoiceStatus.PAID
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : "border-primary/15 bg-primary/5 text-primary"
    : negative
      ? "border-destructive/20 bg-destructive/10 text-destructive"
      : "border-border bg-muted/50 text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}
    >
      {formatEnum(status)}
    </span>
  );
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
    <section className="overflow-visible rounded-xl border border-border bg-card">
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

export default async function PlatformSubscriptionDetailsPage({
  params,
}: RouteContext) {
  await requirePlatformOwnerPage();

  const { subscriptionId } = await params;

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
    notFound();
  }

  const live =
    subscription.status === SubscriptionStatus.ACTIVE ||
    subscription.status === SubscriptionStatus.TRIALING;

  const currentPeriodInvoiceGenerated = subscription.invoices.some(
    (invoice) =>
      invoice.status !== InvoiceStatus.VOID &&
      invoice.periodStart.getTime() === subscription.currentPeriodStart.getTime() &&
      invoice.periodEnd.getTime() === subscription.currentPeriodEnd.getTime(),
  );
  const price =
    subscription.billingCycle === "MONTHLY"
      ? subscription.plan.monthlyPrice
      : subscription.plan.annualPrice;

  return (
    <PlatformShell>
      <PlatformPageLayout>
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <WalletCards className="size-6" strokeWidth={1.7} />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">
                      {subscription.school.name}
                    </h1>

                    <SubscriptionStatusBadge
                      status={subscription.status}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="font-mono">
                      {subscription.id}
                    </span>

                    <span className="text-border">•</span>

                    <span>
                      {subscription.plan.name}
                    </span>

                    <span className="text-border">•</span>

                    <span>
                      Created {formatDateOnly(subscription.createdAt)}
                    </span>
                  </div>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {subscription.plan.description ||
                      `Commercial subscription for ${subscription.school.name}.`}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <SubscriptionLifecycle
                  subscriptionId={subscription.id}
                  currentStatus={subscription.status}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleDollarSign className="size-3.5" />
                {formatEnum(subscription.billingCycle)}
              </div>
              <p className="mt-2 text-lg font-semibold tracking-tight">
                {formatPrice(price, subscription.plan.currency)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Recurring plan price
              </p>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                Current period
              </div>
              <p className="mt-2 text-sm font-semibold">
                {formatDateOnly(subscription.currentPeriodEnd)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Period end
              </p>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Receipt className="size-3.5" />
                Invoices
              </div>
              <p className="mt-2 text-lg font-semibold tracking-tight">
                {subscription._count.invoices.toLocaleString("en")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Generated for this subscription
              </p>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                School
              </div>
              <p className="mt-2 text-sm font-semibold">
                {subscription.school.isActive ? "Operational" : "Inactive"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Tenant status
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Section
              icon={Building2}
              title="School"
              description="The tenant receiving this commercial subscription."
            >
              <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="px-5 py-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    School
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {subscription.school.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {subscription.school.code || "No school code"}
                  </p>
                </div>

                <div className="px-5 py-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    Location
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {subscription.school.city || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {subscription.school.country}
                  </p>
                </div>
              </div>

              <dl className="border-t border-border">
                <DetailRow
                  label="School ID"
                  value={subscription.school.id}
                  mono
                />
                <DetailRow
                  label="Slug"
                  value={subscription.school.slug}
                  mono
                />
                <DetailRow
                  label="Currency"
                  value={subscription.school.currency}
                />
                <DetailRow
                  label="Timezone"
                  value={subscription.school.timezone}
                />
                <DetailRow
                  label="Email"
                  value={subscription.school.email || "—"}
                />
                <DetailRow
                  label="Phone"
                  value={subscription.school.phone || "—"}
                />
              </dl>
            </Section>

            <Section
              icon={Receipt}
              title="Plan"
              description="The commercial package currently assigned to this school."
            >
              <div className="px-5 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold tracking-tight">
                      {subscription.plan.name}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {subscription.plan.slug}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-lg font-semibold">
                      {formatPrice(price, subscription.plan.currency)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatEnum(subscription.billingCycle)}
                    </p>
                  </div>
                </div>
              </div>

              <dl className="border-t border-border">
                <DetailRow
                  label="Plan currency"
                  value={subscription.plan.currency}
                />
                <DetailRow
                  label="Plan active"
                  value={
                    subscription.plan.isActive ? "Yes" : "No"
                  }
                />
                <DetailRow
                  label="Public"
                  value={
                    subscription.plan.isPublic ? "Yes" : "No"
                  }
                />
                <DetailRow
                  label="Student capacity"
                  value={
                    subscription.plan.maxStudents === null
                      ? "Unlimited"
                      : subscription.plan.maxStudents.toLocaleString("en")
                  }
                />
                <DetailRow
                  label="Staff capacity"
                  value={
                    subscription.plan.maxStaff === null
                      ? "Unlimited"
                      : subscription.plan.maxStaff.toLocaleString("en")
                  }
                />
                <DetailRow
                  label="Admin capacity"
                  value={
                    subscription.plan.maxAdmins === null
                      ? "Unlimited"
                      : subscription.plan.maxAdmins.toLocaleString("en")
                  }
                />
              </dl>
            </Section>

            <Section
              icon={CalendarDays}
              title="Subscription timeline"
              description="Dates governing the subscription lifecycle and billing period."
            >
              <dl>
                <DetailRow
                  label="Start date"
                  value={formatDate(subscription.startDate)}
                />
                <DetailRow
                  label="Current period start"
                  value={formatDate(subscription.currentPeriodStart)}
                />
                <DetailRow
                  label="Current period end"
                  value={formatDate(subscription.currentPeriodEnd)}
                />
                <DetailRow
                  label="Trial ends"
                  value={formatDate(subscription.trialEndsAt)}
                />
                <DetailRow
                  label="Canceled at"
                  value={formatDate(subscription.canceledAt)}
                />
                <DetailRow
                  label="Last updated"
                  value={formatDate(subscription.updatedAt)}
                />
              </dl>
            </Section>

            <Section
              icon={FileText}
              title="Recent invoices"
              description="The latest invoices generated against this subscription."
            >
              <div className="border-b border-border px-5 py-3.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium">Current billing period</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Generate the invoice for the active subscription period.
                    </p>
                  </div>
                  <GenerateInvoiceButton
                    subscriptionId={subscription.id}
                    disabled={subscription.status !== SubscriptionStatus.ACTIVE}
                    alreadyGenerated={currentPeriodInvoiceGenerated}
                  />
                </div>
              </div>
              {subscription.invoices.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <FileText
                    className="mx-auto size-8 text-muted-foreground/40"
                    strokeWidth={1.5}
                  />
                  <p className="mt-3 text-sm font-medium">
                    No invoices yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Invoices will appear here when billing records are
                    generated.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {subscription.invoices.map((invoice) => (
                    <Link
                      key={invoice.id}
                      href={`/platform/billing/${invoice.id}`}
                      className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-medium">
                            {invoice.invoiceNumber}
                          </span>

                          <InvoiceStatusBadge status={invoice.status} />
                        </div>

                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {formatDateOnly(invoice.periodStart)} —{" "}
                          {formatDateOnly(invoice.periodEnd)}
                        </p>

                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Issued {formatDate(invoice.issuedAt)} ·{" "}
                          {invoice._count.payments} payment
                          {invoice._count.payments === 1 ? "" : "s"}
                        </p>
                      </div>

                      <div className="shrink-0 sm:text-right">
                        <p className="text-sm font-semibold">
                          {formatPrice(invoice.amount, invoice.currency)}
                        </p>

                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Due {formatDateOnly(invoice.dueAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Section>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <Section
              icon={Clock3}
              title="Lifecycle"
              description="Current operational state of this subscription."
            >
              <div className="px-5 py-5">
                <SubscriptionStatusBadge
                  status={subscription.status}
                />

                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {subscription.status === SubscriptionStatus.ACTIVE
                    ? "The school currently has an active commercial subscription."
                    : subscription.status === SubscriptionStatus.TRIALING
                      ? "The school is currently within its trial period."
                      : subscription.status === SubscriptionStatus.PAST_DUE
                        ? "The subscription remains recorded but requires billing attention."
                        : subscription.status === SubscriptionStatus.PAUSED
                          ? "The subscription is temporarily paused."
                          : subscription.status === SubscriptionStatus.CANCELED
                            ? "This subscription has been canceled and is retained for commercial history."
                            : "This subscription has expired and is retained for commercial history."}
                </p>
              </div>
            </Section>

            <Section
              icon={UserRound}
              title="Commercial record"
              description="Internal identifiers and subscription metadata."
            >
              <dl>
                <DetailRow
                  label="Subscription ID"
                  value={subscription.id}
                  mono
                />
                <DetailRow
                  label="Billing cycle"
                  value={formatEnum(subscription.billingCycle)}
                />
                <DetailRow
                  label="Created"
                  value={formatDate(subscription.createdAt)}
                />
                <DetailRow
                  label="Updated"
                  value={formatDate(subscription.updatedAt)}
                />
                <DetailRow
                  label="Invoice count"
                  value={subscription._count.invoices.toLocaleString("en")}
                />
              </dl>
            </Section>

            <Section
              icon={ShieldCheck}
              title="Operational state"
              description="Subscription and tenant state are maintained independently."
            >
              <div className="space-y-3 px-5 py-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {live ? (
                      <CheckCircle2
                        className="size-4 text-emerald-600"
                        strokeWidth={1.8}
                      />
                    ) : subscription.status ===
                      SubscriptionStatus.CANCELED ? (
                      <XCircle
                        className="size-4 text-destructive"
                        strokeWidth={1.8}
                      />
                    ) : (
                      <PauseCircle
                        className="size-4 text-muted-foreground"
                        strokeWidth={1.8}
                      />
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium">
                      Subscription
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {formatEnum(subscription.status)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium">
                    School tenant
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {subscription.school.isActive
                      ? "Operational and active."
                      : "Inactive. Subscription state does not automatically change tenant state."}
                  </p>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </PlatformPageLayout>
    </PlatformShell>
  );
}
