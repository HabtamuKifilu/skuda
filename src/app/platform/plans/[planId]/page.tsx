import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  EyeOff,
  Receipt,
  Users,
  XCircle,
} from "lucide-react";
import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";
import { SubscriptionStatus } from "@/generated/prisma/enums";

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

function formatLimit(value: number | null) {
  return value === null ? "Unlimited" : value.toLocaleString("en");
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function StatusBadge({
  active,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <span
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
          : "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
      }
    >
      <span
        className={
          active
            ? "size-1.5 rounded-full bg-emerald-500"
            : "size-1.5 rounded-full bg-muted-foreground/50"
        }
      />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  return (
    <span
      className={
        isPublic
          ? "inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary"
          : "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
      }
    >
      {isPublic ? (
        <Eye className="size-3" strokeWidth={1.8} />
      ) : (
        <EyeOff className="size-3" strokeWidth={1.8} />
      )}
      {isPublic ? "Public" : "Private"}
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
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4.5" />
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

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

export default async function PlatformPlanDetailsPage({
  params,
}: RouteContext) {
  await requirePlatformOwnerPage();

  const { planId } = await params;

  const [plan, activeSubscriptionCount] = await Promise.all([
    prisma.plan.findUnique({
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
            createdAt: true,
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
    }),

    prisma.subscription.count({
      where: {
        planId,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
          ],
        },
      },
    }),
  ]);

  if (!plan) {
    notFound();
  }

  return (
    <PlatformShell>
      <div className="w-full px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
        <div className="flex flex-col gap-5">
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Receipt className="size-6" strokeWidth={1.7} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="truncate text-xl font-semibold tracking-tight">
                        {plan.name}
                      </h1>

                      <StatusBadge
                        active={plan.isActive}
                        activeLabel="Active"
                        inactiveLabel="Inactive"
                      />

                      <VisibilityBadge isPublic={plan.isPublic} />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="font-mono">{plan.slug}</span>

                      <span className="text-border">•</span>

                      <span>
                        Created {formatDateOnly(plan.createdAt)}
                      </span>

                      <span className="text-border">•</span>

                      <span>
                        Updated {formatDateOnly(plan.updatedAt)}
                      </span>
                    </div>

                    {plan.description ? (
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                        {plan.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <Link
                  href={`/platform/plans/${plan.id}/edit`}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3.5 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Edit plan
                </Link>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CircleDollarSign className="size-3.5" />
                  Monthly
                </div>
                <p className="mt-2 text-lg font-semibold tracking-tight">
                  {formatPrice(plan.monthlyPrice, plan.currency)}
                </p>
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  Annual
                </div>
                <p className="mt-2 text-lg font-semibold tracking-tight">
                  {formatPrice(plan.annualPrice, plan.currency)}
                </p>
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="size-3.5" />
                  Subscriptions
                </div>
                <p className="mt-2 text-lg font-semibold tracking-tight">
                  {plan._count.subscriptions.toLocaleString("en")}
                </p>
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5" />
                  Active usage
                </div>
                <p className="mt-2 text-lg font-semibold tracking-tight">
                  {activeSubscriptionCount.toLocaleString("en")}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
            <div className="flex min-w-0 flex-col gap-5">
              <Section
                icon={CircleDollarSign}
                title="Pricing configuration"
                description="Recurring commercial pricing for this subscription package."
              >
                <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="px-5 py-5">
                    <p className="text-xs text-muted-foreground">
                      Monthly price
                    </p>

                    <p className="mt-2 text-xl font-semibold tracking-tight">
                      {formatPrice(plan.monthlyPrice, plan.currency)}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Billed every month
                    </p>
                  </div>

                  <div className="px-5 py-5">
                    <p className="text-xs text-muted-foreground">
                      Annual price
                    </p>

                    <p className="mt-2 text-xl font-semibold tracking-tight">
                      {formatPrice(plan.annualPrice, plan.currency)}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Billed every year
                    </p>
                  </div>
                </div>
              </Section>

              <Section
                icon={Users}
                title="Capacity limits"
                description="Operational limits applied to schools using this plan."
              >
                <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <div className="px-5 py-5">
                    <p className="text-xs text-muted-foreground">
                      Maximum students
                    </p>

                    <p className="mt-2 text-lg font-semibold">
                      {formatLimit(plan.maxStudents)}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Student profiles
                    </p>
                  </div>

                  <div className="px-5 py-5">
                    <p className="text-xs text-muted-foreground">
                      Maximum staff
                    </p>

                    <p className="mt-2 text-lg font-semibold">
                      {formatLimit(plan.maxStaff)}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Staff profiles
                    </p>
                  </div>

                  <div className="px-5 py-5">
                    <p className="text-xs text-muted-foreground">
                      Maximum administrators
                    </p>

                    <p className="mt-2 text-lg font-semibold">
                      {formatLimit(plan.maxAdmins)}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Administrative users
                    </p>
                  </div>
                </div>
              </Section>

              <Section
                icon={Building2}
                title="Recent subscriptions"
                description="The latest schools currently associated with this plan."
              >
                {plan.subscriptions.length === 0 ? (
                  <div className="flex min-h-36 items-center justify-center px-5 py-8">
                    <div className="text-center">
                      <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Building2 className="size-5" strokeWidth={1.7} />
                      </div>

                      <p className="mt-3 text-sm font-medium">
                        No subscriptions yet
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Schools assigned to this plan will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {plan.subscriptions.map((subscription) => {
                      const isActive =
                        subscription.status ===
                          SubscriptionStatus.ACTIVE ||
                        subscription.status ===
                          SubscriptionStatus.TRIALING;

                      return (
                        <div
                          key={subscription.id}
                          className="px-5 py-4 transition-colors hover:bg-muted/20"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                <Building2
                                  className="size-4"
                                  strokeWidth={1.7}
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {subscription.school.name}
                                </p>

                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                  {subscription.school.code ? (
                                    <span className="font-mono">
                                      {subscription.school.code}
                                    </span>
                                  ) : null}

                                  {subscription.school.city ? (
                                    <>
                                      <span className="text-border">•</span>
                                      <span>
                                        {subscription.school.city}
                                      </span>
                                    </>
                                  ) : null}

                                  <span className="text-border">•</span>

                                  <span>
                                    {formatEnum(
                                      subscription.billingCycle,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-3">
                              <StatusBadge
                                active={isActive}
                                activeLabel={formatEnum(
                                  subscription.status,
                                )}
                                inactiveLabel={formatEnum(
                                  subscription.status,
                                )}
                              />

                              <div className="text-right">
                                <p className="text-xs font-medium">
                                  {formatDateOnly(
                                    subscription.currentPeriodEnd,
                                  )}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  Period end
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <Section
                icon={BadgeCheck}
                title="Availability"
                description="Controls how this plan can be used across the platform."
              >
                <div className="divide-y divide-border">
                  <div className="flex items-start gap-3 px-5 py-4">
                    {plan.isActive ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {plan.isActive ? "Active plan" : "Inactive plan"}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {plan.isActive
                          ? "This plan is available for subscription assignment."
                          : "This plan cannot be selected for new subscription assignments."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 px-5 py-4">
                    {plan.isPublic ? (
                      <Eye className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : (
                      <EyeOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {plan.isPublic ? "Public offering" : "Private offering"}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {plan.isPublic
                          ? "This plan may be exposed in public-facing subscription selection experiences."
                          : "This plan is restricted to platform-managed assignment workflows."}
                      </p>
                    </div>
                  </div>
                </div>
              </Section>

              <Section
                icon={CalendarDays}
                title="Plan metadata"
                description="Identity and lifecycle information for this commercial plan."
              >
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="text-xs text-muted-foreground">
                      Plan ID
                    </span>
                    <span className="max-w-[190px] truncate font-mono text-xs">
                      {plan.id}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="text-xs text-muted-foreground">
                      Slug
                    </span>
                    <span className="font-mono text-xs">
                      {plan.slug}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="text-xs text-muted-foreground">
                      Currency
                    </span>
                    <span className="text-xs font-medium">
                      {plan.currency}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="text-xs text-muted-foreground">
                      Created
                    </span>
                    <span className="text-right text-xs font-medium">
                      {formatDate(plan.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <span className="text-xs text-muted-foreground">
                      Last updated
                    </span>
                    <span className="text-right text-xs font-medium">
                      {formatDate(plan.updatedAt)}
                    </span>
                  </div>
                </div>
              </Section>

              <section className="overflow-hidden rounded-xl border border-border bg-muted/20">
                <div className="border-b border-border px-4 py-3.5 sm:px-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Receipt className="size-4.5" />
                    </div>

                    <div>
                      <h2 className="text-[13px] font-semibold">
                        Commercial administration
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Subscription and billing workflows build on this plan.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-5">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

                    <p className="text-xs leading-5 text-muted-foreground">
                      This plan is ready to be assigned to schools. Subscription
                      lifecycle, invoice generation, and payment reconciliation
                      are managed through the commercial control plane.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}
