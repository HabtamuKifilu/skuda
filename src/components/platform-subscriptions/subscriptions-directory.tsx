"use client";

import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  Plus,
  Search,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "PAUSED"
  | "CANCELED"
  | "EXPIRED";

type BillingCycle = "MONTHLY" | "ANNUAL";

type Subscription = {
  id: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startDate: string;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  school: {
    id: string;
    name: string;
    code: string | null;
    city: string | null;
    country: string;
    isActive: boolean;
  };
  plan: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    monthlyPrice: string | number;
    annualPrice: string | number;
    isActive: boolean;
  };
};

type SubscriptionResponse = {
  subscriptions: Subscription[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  counts: {
    total: number;
    active: number;
    trialing: number;
    pastDue: number;
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatPrice(
  amount: string | number,
  currency: string,
  billingCycle: BillingCycle,
) {
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount)) + (billingCycle === "MONTHLY" ? "/mo" : "/yr")
  );
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const config = {
    ACTIVE: {
      label: "Active",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
    TRIALING: {
      label: "Trialing",
      className:
        "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
      dot: "bg-blue-500",
    },
    PAST_DUE: {
      label: "Past due",
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500",
    },
    PAUSED: {
      label: "Paused",
      className:
        "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400",
      dot: "bg-violet-500",
    },
    CANCELED: {
      label: "Canceled",
      className: "border-border bg-muted text-muted-foreground",
      dot: "bg-muted-foreground/50",
    },
    EXPIRED: {
      label: "Expired",
      className: "border-border bg-muted text-muted-foreground",
      dot: "bg-muted-foreground/50",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${config.className}`}
    >
      <span className={`size-1.5 rounded-full ${config.dot}`} />
      {config.label}
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
  icon: typeof WalletCards;
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

export function SubscriptionsDirectory() {
  const [data, setData] = useState<SubscriptionResponse | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [billingCycle, setBillingCycle] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();

    if (query.trim()) {
      params.set("q", query.trim());
    }

    if (status) {
      params.set("status", status);
    }

    if (billingCycle) {
      params.set("billingCycle", billingCycle);
    }

    params.set("page", String(page));

    try {
      const response = await fetch(
        `/api/platform/subscriptions?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || "Failed to load subscriptions.",
        );
      }

      setData(payload);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load subscriptions.",
      );
    } finally {
      setLoading(false);
    }
  }, [billingCycle, page, query, status]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void loadSubscriptions();
      },
      query ? 300 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [loadSubscriptions, query]);

  useEffect(() => {
    setPage(1);
  }, [query, status, billingCycle]);

  const subscriptions = data?.subscriptions ?? [];

  const counts = data?.counts ?? {
    total: 0,
    active: 0,
    trialing: 0,
    pastDue: 0,
  };

  const pagination = data?.pagination ?? {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  };

  const hasFilters = Boolean(
    query.trim() || status || billingCycle,
  );

  const visibleRange = useMemo(() => {
    if (pagination.total === 0) {
      return "0 results";
    }

    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(
      pagination.page * pagination.pageSize,
      pagination.total,
    );

    return `${start}–${end} of ${pagination.total}`;
  }, [pagination]);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total subscriptions"
          value={counts.total}
          description="All subscription records"
          icon={WalletCards}
        />

        <MetricCard
          label="Active"
          value={counts.active}
          description="Currently active subscriptions"
          icon={CheckCircle2}
        />

        <MetricCard
          label="Trialing"
          value={counts.trialing}
          description="Schools currently in trial"
          icon={Clock3}
        />

        <MetricCard
          label="Past due"
          value={counts.pastDue}
          description="Require billing attention"
          icon={AlertCircle}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">
                  Subscription directory
                </h2>

                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {pagination.total}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                School plan assignments and current commercial lifecycle
                status.
              </p>
            </div>

            <Link
              href="/platform/subscriptions/new"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Create subscription
            </Link>
          </div>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search school, school code, or plan..."
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              />

              {loading && query ? (
                <span className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-muted border-t-primary" />
              ) : null}
            </div>

            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1 lg:w-40 lg:flex-none">
                <Filter className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />

                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-9 w-full appearance-none rounded-lg border border-border bg-background pl-8 pr-8 text-xs outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="TRIALING">Trialing</option>
                  <option value="PAST_DUE">Past due</option>
                  <option value="PAUSED">Paused</option>
                  <option value="CANCELED">Canceled</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>

              <select
                value={billingCycle}
                onChange={(event) => setBillingCycle(event.target.value)}
                className="h-9 min-w-32 appearance-none rounded-lg border border-border bg-background px-3 text-xs outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="">All cycles</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
              </select>

              {hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatus("");
                    setBillingCycle("");
                    setPage(1);
                  }}
                  className="h-9 shrink-0 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <div className="px-6 py-14">
            <div className="mx-auto flex max-w-md flex-col items-center text-center">
              <div className="flex size-11 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
                <AlertCircle className="size-5" />
              </div>

              <h3 className="mt-4 text-sm font-semibold">
                Unable to load subscriptions
              </h3>

              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void loadSubscriptions()}
                className="mt-5 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted"
              >
                Try again
              </button>
            </div>
          </div>
        ) : loading && !data ? (
          <div className="px-5 py-12">
            <div className="space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-lg bg-muted/50"
                />
              ))}
            </div>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="px-6 py-16 sm:px-10">
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <div className="flex size-12 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                {hasFilters ? (
                  <Search className="size-6" strokeWidth={1.7} />
                ) : (
                  <WalletCards className="size-6" strokeWidth={1.7} />
                )}
              </div>

              <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary">
                Subscription directory
              </p>

              <h3 className="mt-2 text-lg font-semibold tracking-tight">
                {hasFilters
                  ? "No subscriptions match your filters"
                  : "No subscriptions yet"}
              </h3>

              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                {hasFilters
                  ? "Try a different search term or clear the current filters to see more subscription records."
                  : "Create a subscription to assign an active or trialing commercial plan to a school."}
              </p>

              {hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatus("");
                    setBillingCycle("");
                    setPage(1);
                  }}
                  className="mt-6 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted"
                >
                  Clear filters
                </button>
              ) : (
                <Link
                  href="/platform/subscriptions/new"
                  className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="size-4" />
                  Create subscription
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="hidden border-b border-border bg-muted/20 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground lg:grid lg:grid-cols-[minmax(260px,1.45fr)_minmax(180px,1fr)_125px_125px_170px_110px] lg:gap-5">
              <span>School</span>
              <span>Plan</span>
              <span>Status</span>
              <span>Billing</span>
              <span>Current period</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="divide-y divide-border">
              {subscriptions.map((subscription) => (
                <div
                  key={subscription.id}
                  className="px-5 py-5 transition-colors hover:bg-muted/20"
                >
                  <div className="grid gap-5 lg:grid-cols-[minmax(260px,1.45fr)_minmax(180px,1fr)_125px_125px_170px_110px] lg:items-center lg:gap-5">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                        School
                      </p>

                      <div className="mt-1 flex min-w-0 items-center gap-2 lg:mt-0">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                          {subscription.school.name
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {subscription.school.name}
                          </p>

                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {subscription.school.code || "No school code"}
                            {subscription.school.city
                              ? ` · ${subscription.school.city}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                        Plan
                      </p>

                      <p className="mt-1 truncate text-sm font-medium lg:mt-0">
                        {subscription.plan.name}
                      </p>

                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                        {subscription.plan.slug}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                        Status
                      </p>

                      <div className="mt-1 lg:mt-0">
                        <StatusBadge status={subscription.status} />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                        Billing
                      </p>

                      <p className="mt-1 text-sm font-medium lg:mt-0">
                        {subscription.billingCycle === "MONTHLY"
                          ? "Monthly"
                          : "Annual"}
                      </p>

                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatPrice(
                          subscription.billingCycle === "MONTHLY"
                            ? subscription.plan.monthlyPrice
                            : subscription.plan.annualPrice,
                          subscription.plan.currency,
                          subscription.billingCycle,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                        Current period
                      </p>

                      <div className="mt-1 lg:mt-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <CalendarDays className="size-3.5 text-muted-foreground" />
                          {formatDate(subscription.currentPeriodEnd)}
                        </div>

                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Started {formatDate(subscription.currentPeriodStart)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-start border-t border-border pt-4 lg:justify-end lg:border-t-0 lg:pt-0">
                      <Link
                        href={`/platform/subscriptions/${subscription.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        <Eye className="size-3.5" />
                        View
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3 text-[11px] text-muted-foreground lg:hidden">
                    <span>
                      Started:{" "}
                      <span className="font-medium text-foreground">
                        {formatDate(subscription.startDate)}
                      </span>
                    </span>

                    {subscription.trialEndsAt ? (
                      <span>
                        Trial ends:{" "}
                        <span className="font-medium text-foreground">
                          {formatDate(subscription.trialEndsAt)}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {visibleRange}
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                  className="h-8 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="px-2 text-xs text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <button
                  type="button"
                  disabled={
                    pagination.page >= pagination.totalPages || loading
                  }
                  onClick={() =>
                    setPage((current) =>
                      Math.min(pagination.totalPages, current + 1),
                    )
                  }
                  className="h-8 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
