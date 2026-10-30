"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileText,
  History,
  RefreshCw,
  UserRoundCheck,
} from "lucide-react";

type HistoryEntry = {
  id: string;
  changeType: string;
  effectiveDate: string;
  previousJobTitle: string | null;
  newJobTitle: string | null;
  previousDepartment: string | null;
  newDepartment: string | null;
  description: string | null;
  notes: string | null;
  createdAt: string;
};

const eventConfig: Record<
  string,
  { title: string; description: string; icon: typeof BriefcaseBusiness }
> = {
  HIRED: {
    title: "Employee registered",
    description: "Initial employee record",
    icon: UserRoundCheck,
  },
  PROMOTION: {
    title: "Promotion",
    description: "Career progression",
    icon: ArrowUpRight,
  },
  TRANSFER: {
    title: "Role and department change",
    description: "Position and organizational assignment",
    icon: ArrowLeftRight,
  },
  CONTRACT_STARTED: {
    title: "Contract started",
    description: "Employment contract initiated",
    icon: FileText,
  },
  CONTRACT_RENEWED: {
    title: "Contract renewed",
    description: "Contract period extended",
    icon: CalendarClock,
  },
  CONTRACT_CHANGED: {
    title: "Employment terms updated",
    description: "Employment terms amended",
    icon: FileText,
  },
  ROLE_CHANGED: {
    title: "Job title changed",
    description: "Position assignment updated",
    icon: ArrowUpRight,
  },
  DEPARTMENT_CHANGED: {
    title: "Department changed",
    description: "Organizational assignment updated",
    icon: Building2,
  },
  OTHER: {
    title: "Employment update",
    description: "General employment record",
    icon: History,
  },
};

function formatDate(value: string, includeTime = false) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date not recorded";

  return new Intl.DateTimeFormat(
    "en",
    includeTime
      ? {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : {
          day: "2-digit",
          month: "short",
          year: "numeric",
        },
  ).format(date);
}

function ChangeRow({
  label,
  previous,
  updated,
}: {
  label: string;
  previous: string | null;
  updated: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 border-t border-border/70 px-3 py-3 sm:grid-cols-[minmax(105px,0.7fr)_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3 sm:px-4">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>

      <div className="min-w-0 rounded-md border border-border/70 bg-muted/30 px-3 py-2">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Previous
        </span>
        <p className="break-words text-[13px] text-muted-foreground">
          {previous || "Unassigned"}
        </p>
      </div>

      <ArrowRight
        aria-hidden="true"
        className="hidden size-3.5 text-muted-foreground sm:block"
      />

      <div className="min-w-0 rounded-md border border-primary/15 bg-primary/[0.035] px-3 py-2">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-primary">
          Updated
        </span>
        <p className="break-words text-[13px] font-semibold text-foreground">
          {updated || "Unassigned"}
        </p>
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading employment history">
      {[0, 1].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-xl border border-border p-4"
        >
          <div className="flex items-start gap-3">
            <div className="size-9 shrink-0 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3.5 w-44 max-w-full rounded bg-muted" />
              <div className="h-3 w-32 max-w-full rounded bg-muted" />
            </div>
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
          <div className="mt-5 h-16 rounded-lg bg-muted/60" />
        </div>
      ))}
    </div>
  );
}

export function EmployeeEmploymentHistory({
  schoolId,
  staffId,
}: {
  schoolId: string;
  staffId: string;
}) {
  const endpoint =
    `/api/schools/${encodeURIComponent(schoolId)}` +
    `/staff/${encodeURIComponent(staffId)}/employment-history`;

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Unable to load employment history.",
        );
      }

      setEntries(Array.isArray(result.history) ? result.history : []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load employment history.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    void loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory]);

  return (
    <section
      aria-labelledby="employment-history-heading"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
            <History
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          </div>

          <div className="min-w-0">
            <h2
              id="employment-history-heading"
              className="text-sm font-semibold tracking-tight"
            >
              Employment history
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-[13px]">
              A chronological record of career milestones, role assignments,
              and contract changes.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
          {!loading && !error && entries.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              <CircleDot aria-hidden="true" className="size-3" />
              {entries.length} {entries.length === 1 ? "event" : "events"}
            </span>
          ) : null}

          {!loading && !error && entries.length === 0 ? (
            <span className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
              No events
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {loading ? (
          <HistorySkeleton />
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5">
              <CircleDot
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-destructive"
              />
              <div>
                <p className="text-[13px] font-semibold">
                  Unable to load employment history
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadHistory()}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Try again
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-5 py-10 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/30">
              <BriefcaseBusiness
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
            </div>
            <h3 className="mt-4 text-sm font-semibold">
              No employment events yet
            </h3>
            <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
              Employee registration and future role, department, and contract
              changes will appear here as they are recorded.
            </p>
          </div>
        ) : (
          <ol className="space-y-4">
            {entries.map((entry, index) => {
              const config = eventConfig[entry.changeType] ?? {
                title: entry.changeType.replaceAll("_", " "),
                description: "Employment record updated",
                icon: History,
              };
              const EventIcon = config.icon;

              const hasJobTitleChange =
                entry.previousJobTitle !== entry.newJobTitle &&
                Boolean(entry.previousJobTitle || entry.newJobTitle);

              const hasDepartmentChange =
                entry.previousDepartment !== entry.newDepartment &&
                Boolean(entry.previousDepartment || entry.newDepartment);

              return (
                <li key={entry.id} className="relative">
                  {index > 0 ? (
                    <div className="mb-3 flex items-center gap-2 px-1">
                      <span className="h-px flex-1 bg-border/70" />
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Earlier record
                      </span>
                      <span className="h-px flex-1 bg-border/70" />
                    </div>
                  ) : null}

                  <article className="overflow-hidden rounded-xl border border-border bg-background transition-colors">
                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/[0.045]">
                          <EventIcon
                            aria-hidden="true"
                            className="size-[18px] text-primary"
                          />
                        </div>

                        <div className="min-w-0 pt-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[13px] font-semibold leading-5">
                              {config.title}
                            </h3>
                            {entry.changeType === "HIRED" ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                <CheckCircle2
                                  aria-hidden="true"
                                  className="size-3"
                                />
                                Initial record
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {config.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-start gap-2 sm:pl-3">
                        <CalendarClock
                          aria-hidden="true"
                          className="mt-0.5 size-3.5 text-muted-foreground"
                        />
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            Effective date
                          </p>
                          <time
                            dateTime={entry.effectiveDate}
                            className="mt-1 block text-xs font-semibold tabular-nums"
                          >
                            {formatDate(entry.effectiveDate)}
                          </time>
                        </div>
                      </div>
                    </div>

                    {hasJobTitleChange || hasDepartmentChange ? (
                      <div className="mx-4 mb-4 overflow-hidden rounded-lg border border-border/80 sm:mx-5">
                        <div className="flex items-center justify-between gap-3 bg-muted/30 px-3 py-2.5 sm:px-4">
                          <div className="flex items-center gap-2">
                            <ArrowLeftRight
                              aria-hidden="true"
                              className="size-3.5 text-muted-foreground"
                            />
                            <h4 className="text-xs font-semibold">
                              Changes recorded
                            </h4>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {Number(hasJobTitleChange) +
                              Number(hasDepartmentChange)}{" "}
                            {Number(hasJobTitleChange) +
                              Number(hasDepartmentChange) ===
                            1
                              ? "field"
                              : "fields"}
                          </span>
                        </div>

                        {hasJobTitleChange ? (
                          <ChangeRow
                            label="Job title"
                            previous={entry.previousJobTitle}
                            updated={entry.newJobTitle}
                          />
                        ) : null}

                        {hasDepartmentChange ? (
                          <ChangeRow
                            label="Department"
                            previous={entry.previousDepartment}
                            updated={entry.newDepartment}
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {entry.description || entry.notes ? (
                      <div className="border-t border-border/70 px-4 py-3.5 sm:px-5">
                        {entry.description ? (
                          <div className="flex items-start gap-2.5">
                            <FileText
                              aria-hidden="true"
                              className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                            />
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Record details
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-foreground/85">
                                {entry.description}
                              </p>
                            </div>
                          </div>
                        ) : null}

                        {entry.notes ? (
                          <div
                            className={`${entry.description ? "mt-3 border-t border-border/60 pt-3" : ""} flex items-start gap-2.5`}
                          >
                            <FileText
                              aria-hidden="true"
                              className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                            />
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Notes
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                                {entry.notes}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/70 bg-muted/15 px-4 py-2.5 sm:px-5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock3
                          aria-hidden="true"
                          className="size-3.5 shrink-0"
                        />
                        Recorded {formatDate(entry.createdAt, true)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Employment record
                      </span>
                    </footer>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
