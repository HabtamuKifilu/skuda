import Link from "next/link";
import {
  CheckCircle2,
  CircleDollarSign,
  Eye,
  EyeOff,
  Plus,
  Receipt,
  Users,
} from "lucide-react";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { PlatformPageLayout } from "@/components/platform-shell/platform-page";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

function formatPrice(amount: unknown, currency: string) {
  const numericAmount = Number(amount);

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

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" />
      Inactive
    </span>
  );
}

function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  return isPublic ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
      <Eye className="size-3.5" />
      Public
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
      <EyeOff className="size-3.5" />
      Private
    </span>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: typeof Receipt;
}) {
  return (
    <div className="flex min-h-[116px] items-start justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>

        <p className="mt-2 text-2xl font-semibold tracking-tight">
          {value.toLocaleString("en")}
        </p>

        <p className="mt-1 truncate text-xs text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-[18px]" strokeWidth={1.8} />
      </div>
    </div>
  );
}

export default async function PlatformPlansPage() {
  await requirePlatformOwnerPage();

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
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
  });

  const activePlans = plans.filter((plan) => plan.isActive).length;
  const publicPlans = plans.filter((plan) => plan.isPublic).length;
  const assignedSubscriptions = plans.reduce(
    (total, plan) => total + plan._count.subscriptions,
    0,
  );

  return (
    <PlatformShell>
      <PlatformPageLayout>
        <section className="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Receipt className="size-4" strokeWidth={1.8} />
              <span>Commercial</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-muted-foreground">Plans</span>
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Plans
            </h1>

            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Manage the subscription packages offered to schools, including
              pricing, visibility, and operational limits.
            </p>
          </div>

          <Link
            href="/platform/plans/new"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Create plan
          </Link>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total plans"
            value={plans.length}
            description="Configured packages"
            icon={Receipt}
          />

          <MetricCard
            label="Active"
            value={activePlans}
            description="Available for assignment"
            icon={CheckCircle2}
          />

          <MetricCard
            label="Public"
            value={publicPlans}
            description="Visible to schools"
            icon={Eye}
          />

          <MetricCard
            label="Subscriptions"
            value={assignedSubscriptions}
            description="Current plan assignments"
            icon={Users}
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Plan catalog</h2>

                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {plans.length}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                Subscription packages available across the SKUDA platform.
              </p>
            </div>

            {plans.length > 0 ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{activePlans} active</span>
                <span className="text-border">•</span>
                <span>{publicPlans} public</span>
              </div>
            ) : null}
          </div>

          {plans.length === 0 ? (
            <div className="px-6 py-16 sm:px-10">
              <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                <div className="flex size-12 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                  <CircleDollarSign className="size-6" strokeWidth={1.7} />
                </div>

                <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary">
                  Plan catalog
                </p>

                <h3 className="mt-2 text-lg font-semibold tracking-tight">
                  Your commercial catalog is ready
                </h3>

                <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                  No subscription plans have been configured yet. Create a
                  plan to define pricing, school capacity limits, and whether
                  the package is publicly available.
                </p>

                <div className="mt-6 grid w-full max-w-lg gap-2 text-left sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
                    <p className="text-xs font-medium">Pricing</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      Monthly and annual rates
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
                    <p className="text-xs font-medium">Capacity</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      Student, staff, and admin limits
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
                    <p className="text-xs font-medium">Visibility</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      Public or private availability
                    </p>
                  </div>
                </div>

                <Link
                  href="/platform/plans/new"
                  className="mt-7 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="size-4" />
                  Create your first plan
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="hidden border-b border-border bg-muted/20 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground lg:grid lg:grid-cols-[minmax(260px,1.4fr)_140px_140px_120px_120px_150px] lg:gap-5">
                <span>Plan</span>
                <span>Monthly</span>
                <span>Annual</span>
                <span>Students</span>
                <span>Subscriptions</span>
                <span className="text-right">Actions</span>
              </div>

              <div className="divide-y divide-border">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="px-5 py-5 transition-colors hover:bg-muted/20"
                  >
                    <div className="grid gap-5 lg:grid-cols-[minmax(260px,1.4fr)_140px_140px_120px_120px_150px] lg:items-center lg:gap-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold">
                            {plan.name}
                          </h3>

                          <StatusBadge active={plan.isActive} />
                          <VisibilityBadge isPublic={plan.isPublic} />
                        </div>

                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {plan.slug}
                        </p>

                        {plan.description ? (
                          <p className="mt-2 line-clamp-2 max-w-xl text-xs leading-5 text-muted-foreground">
                            {plan.description}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                          Monthly
                        </p>
                        <p className="mt-1 text-sm font-semibold lg:mt-0">
                          {formatPrice(plan.monthlyPrice, plan.currency)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          / month
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                          Annual
                        </p>
                        <p className="mt-1 text-sm font-semibold lg:mt-0">
                          {formatPrice(plan.annualPrice, plan.currency)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          / year
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                          Students
                        </p>
                        <p className="mt-1 text-sm font-medium lg:mt-0">
                          {formatLimit(plan.maxStudents)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                          Subscriptions
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 lg:mt-0">
                          <Users className="size-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {plan._count.subscriptions}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-start gap-2 border-t border-border pt-4 lg:justify-end lg:border-t-0 lg:pt-0">
                        <Link
                          href={`/platform/plans/${plan.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                        >
                          <Eye className="size-3.5" />
                          View
                        </Link>

                        <Link
                          href={`/platform/plans/${plan.id}/edit`}
                          className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3 text-[11px] text-muted-foreground lg:hidden">
                      <span>
                        Staff:{" "}
                        <span className="font-medium text-foreground">
                          {formatLimit(plan.maxStaff)}
                        </span>
                      </span>

                      <span>
                        Admins:{" "}
                        <span className="font-medium text-foreground">
                          {formatLimit(plan.maxAdmins)}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </PlatformPageLayout>
    </PlatformShell>
  );
}
