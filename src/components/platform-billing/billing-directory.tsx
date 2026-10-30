"use client";

import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Filter,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PAID"
  | "PAST_DUE"
  | "VOID"
  | "UNCOLLECTIBLE";

type BillingCycle = "MONTHLY" | "ANNUAL";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  amount: string | number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  school: {
    id: string;
    name: string;
    code: string | null;
    city: string | null;
    country: string;
    isActive: boolean;
  };
  subscription: {
    id: string;
    status:
      | "TRIALING"
      | "ACTIVE"
      | "PAST_DUE"
      | "PAUSED"
      | "CANCELED"
      | "EXPIRED";
    billingCycle: BillingCycle;
    plan: {
      id: string;
      name: string;
      slug: string;
    };
  };
  _count: {
    payments: number;
  };
  successfulPaymentTotal: string | number;
};

type BillingResponse = {
  invoices: Invoice[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  counts: {
    total: number;
    issued: number;
    paid: number;
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

function formatDateRange(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function formatAmount(amount: string | number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config = {
    DRAFT: {
      label: "Draft",
      className: "border-border bg-muted text-muted-foreground",
      dot: "bg-muted-foreground/50",
    },
    ISSUED: {
      label: "Issued",
      className:
        "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
      dot: "bg-blue-500",
    },
    PAID: {
      label: "Paid",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
    PAST_DUE: {
      label: "Past due",
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500",
    },
    VOID: {
      label: "Void",
      className: "border-border bg-muted text-muted-foreground",
      dot: "bg-muted-foreground/50",
    },
    UNCOLLECTIBLE: {
      label: "Uncollectible",
      className:
        "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400",
      dot: "bg-red-500",
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
  icon: typeof FileText;
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

export function BillingDirectory() {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();

    if (query.trim()) {
      params.set("q", query.trim());
    }

    if (status) {
      params.set("status", status);
    }

    params.set("page", String(page));

    try {
      const response = await fetch(
        `/api/platform/invoices?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || "Failed to load billing records.",
        );
      }

      setData(payload);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load billing records.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void loadInvoices();
      },
      query ? 300 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [loadInvoices, query]);

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  const invoices = data?.invoices ?? [];

  const counts = data?.counts ?? {
    total: 0,
    issued: 0,
    paid: 0,
    pastDue: 0,
  };

  const pagination = data?.pagination ?? {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  };

  const hasFilters = Boolean(query.trim() || status);

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
          label="Total invoices"
          value={counts.total}
          description="All invoice records"
          icon={FileText}
        />

        <MetricCard
          label="Issued"
          value={counts.issued}
          description="Awaiting settlement"
          icon={Clock3}
        />

        <MetricCard
          label="Paid"
          value={counts.paid}
          description="Successfully settled"
          icon={CheckCircle2}
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
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">
                Invoice directory
              </h2>

              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {pagination.total}
              </span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Commercial invoices, billing periods, and settlement status
              across schools.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search invoice, school, school code, or plan..."
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
                  <option value="DRAFT">Draft</option>
                  <option value="ISSUED">Issued</option>
                  <option value="PAID">Paid</option>
                  <option value="PAST_DUE">Past due</option>
                  <option value="VOID">Void</option>
                  <option value="UNCOLLECTIBLE">
                    Uncollectible
                  </option>
                </select>
              </div>

              {hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatus("");
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
                Unable to load billing records
              </h3>

              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void loadInvoices()}
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
        ) : invoices.length === 0 ? (
          <div className="px-6 py-16 sm:px-10">
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <div className="flex size-12 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                {hasFilters ? (
                  <Search className="size-6" strokeWidth={1.7} />
                ) : (
                  <FileText className="size-6" strokeWidth={1.7} />
                )}
              </div>

              <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.12em] text-primary">
                Billing directory
              </p>

              <h3 className="mt-2 text-lg font-semibold tracking-tight">
                {hasFilters
                  ? "No invoices match your filters"
                  : "No invoices yet"}
              </h3>

              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                {hasFilters
                  ? "Try a different search term or clear the current filters to see more invoice records."
                  : "Invoices will appear here when commercial billing records are generated for active subscriptions."}
              </p>

              {hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatus("");
                    setPage(1);
                  }}
                  className="mt-6 inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="hidden border-b border-border bg-muted/20 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground lg:grid lg:grid-cols-[minmax(240px,1.35fr)_minmax(210px,1.2fr)_130px_145px_170px_105px] lg:gap-5">
              <span>Invoice</span>
              <span>School / plan</span>
              <span>Status</span>
              <span>Amount</span>
              <span>Billing period</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="divide-y divide-border">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="px-5 py-5 transition-colors hover:bg-muted/20"
                >
                  <div className="grid gap-5 lg:grid-cols-[minmax(240px,1.35fr)_minmax(210px,1.2fr)_130px_145px_170px_105px] lg:items-center lg:gap-5">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                        Invoice
                      </p>

                      <div className="mt-1 flex items-center gap-2 lg:mt-0">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <FileText className="size-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {invoice.invoiceNumber}
                          </p>

                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Issued {formatDate(invoice.issuedAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                        School / plan
                      </p>

                      <p className="mt-1 truncate text-sm font-medium lg:mt-0">
                        {invoice.school.name}
                      </p>

                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {invoice.subscription.plan.name} ·{" "}
                        {invoice.subscription.billingCycle === "MONTHLY"
                          ? "Monthly"
                          : "Annual"}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                        Status
                      </p>

                      <div className="mt-1 lg:mt-0">
                        <StatusBadge status={invoice.status} />
                      </div>

                      {invoice._count.payments > 0 ? (
                        <p className="mt-1.5 text-[10px] text-muted-foreground">
                          {invoice._count.payments} payment
                          {invoice._count.payments === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                        Amount
                      </p>

                      <p className="mt-1 text-sm font-semibold tabular-nums lg:mt-0">
                        {formatAmount(invoice.amount, invoice.currency)}
                      </p>

                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Settled {formatAmount(invoice.successfulPaymentTotal, invoice.currency)}
                      </p>

                      {Math.max(
                        0,
                        Number(invoice.amount) - Number(invoice.successfulPaymentTotal),
                      ) > 0 ? (
                        <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          Outstanding {formatAmount(
                            Math.max(
                              0,
                              Number(invoice.amount) - Number(invoice.successfulPaymentTotal),
                            ),
                            invoice.currency,
                          )}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                          Settled in full
                        </p>
                      )}

                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Due {formatDate(invoice.dueAt)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
                        Billing period
                      </p>

                      <div className="mt-1 flex items-start gap-1.5 lg:mt-0">
                        <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />

                        <p className="text-xs leading-5 text-muted-foreground">
                          {formatDateRange(
                            invoice.periodStart,
                            invoice.periodEnd,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-start lg:justify-end">
                      <Link
                        href={`/platform/billing/${invoice.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                      >
                        <Eye className="size-3.5" />
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {visibleRange}
              </p>

              <div className="flex items-center gap-2">
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

                <span className="min-w-16 text-center text-xs text-muted-foreground">
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
