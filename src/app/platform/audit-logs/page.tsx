import Link from "next/link";
import {
  Activity,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileClock,
  Filter,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { Prisma } from "@/generated/prisma/client";
import { headers } from "next/headers";
import { PlatformMembershipRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformRole } from "@/lib/platform-authorization";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { PlatformPageLayout } from "@/components/platform-shell/platform-page";

const PAGE_SIZE = 20;

function formatAction(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-ET", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatDateOnly(value: Date) {
  return new Intl.DateTimeFormat("en-ET", {
    dateStyle: "medium",
  }).format(value);
}

function truncate(value: string | null | undefined, length = 28) {
  if (!value) return "—";
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function getInitials(name: string | null | undefined, email?: string | null) {
  const source = name?.trim() || email?.trim() || "System";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  tone?: "default" | "success" | "danger" | "primary";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "bg-destructive/10 text-destructive"
        : tone === "primary"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {value.toLocaleString()}
          </p>
        </div>

        <div className={`flex size-9 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

export default async function PlatformAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    action?: string;
    resourceType?: string;
    status?: string;
    page?: string;
  }>;
}) {
  await requirePlatformRole(await headers(), [PlatformMembershipRole.PLATFORM_OWNER]);

  const params = await searchParams;

  const q = params.q?.trim() || "";
  const action = params.action?.trim() || "";
  const resourceType = params.resourceType?.trim() || "";
  const status = params.status === "success" || params.status === "failed"
    ? params.status
    : "";

  const requestedPage = Number.parseInt(params.page || "1", 10);
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;

  const where: Prisma.AuditLogWhereInput = {};

  if (q) {
    where.OR = [
      {
        action: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        resourceType: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        resourceId: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        ipAddress: {
          contains: q,
          mode: "insensitive",
        },
      },
      {
        errorCode: {
          contains: q,
          mode: "insensitive",
        },
      },
    ];
  }

  if (action) {
    where.action = action;
  }

  if (resourceType) {
    where.resourceType = resourceType;
  }

  if (status === "success") {
    where.success = true;
  }

  if (status === "failed") {
    where.success = false;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [
    totalEvents,
    successfulEvents,
    failedEvents,
    todayEvents,
    actionOptions,
    resourceOptions,
  ] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({
      where: {
        success: true,
      },
    }),
    prisma.auditLog.count({
      where: {
        success: false,
      },
    }),
    prisma.auditLog.count({
      where: {
        createdAt: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: {
        action: true,
      },
      orderBy: {
        action: "asc",
      },
    }),
    prisma.auditLog.findMany({
      distinct: ["resourceType"],
      select: {
        resourceType: true,
      },
      orderBy: {
        resourceType: "asc",
      },
    }),
  ]);

  const filteredCount = await prisma.auditLog.count({
    where,
  });

  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const currentPage = Math.min(safePage, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: PAGE_SIZE,
  });

  const actorIds = [
    ...new Set(
      logs
        .map((log) => log.actorId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const schoolIds = [
    ...new Set(
      logs
        .map((log) => log.schoolId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [actors, schools] = await Promise.all([
    actorIds.length
      ? prisma.user.findMany({
          where: {
            id: {
              in: actorIds,
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [],
    schoolIds.length
      ? prisma.school.findMany({
          where: {
            id: {
              in: schoolIds,
            },
          },
          select: {
            id: true,
            name: true,
            code: true,
          },
        })
      : [],
  ]);

  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
  const schoolMap = new Map(schools.map((school) => [school.id, school]));

  const firstResult = filteredCount === 0 ? 0 : skip + 1;
  const lastResult = Math.min(skip + logs.length, filteredCount);

  function pageHref(page: number) {
    const query = new URLSearchParams();

    if (q) query.set("q", q);
    if (action) query.set("action", action);
    if (resourceType) query.set("resourceType", resourceType);
    if (status) query.set("status", status);
    if (page > 1) query.set("page", String(page));

    const queryString = query.toString();
    return `/platform/audit-logs${queryString ? `?${queryString}` : ""}`;
  }

  return (
    <PlatformShell>
      <PlatformPageLayout>
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileClock className="size-5" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold tracking-tight text-foreground">
                      Audit Logs
                    </h1>
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Governance
                    </span>
                  </div>

                  <p className="mt-1 max-w-2xl text-[12px] leading-5 text-muted-foreground">
                    Review platform activity, administrative actions, security
                    events, and operational changes across SKUDA.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" />
                <span>Platform owner access</span>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Events"
              value={totalEvents}
              icon={Activity}
              tone="primary"
            />
            <StatCard
              label="Successful"
              value={successfulEvents}
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard
              label="Failed"
              value={failedEvents}
              icon={XCircle}
              tone="danger"
            />
            <StatCard
              label="Today"
              value={todayEvents}
              icon={Clock3}
            />
          </section>

          <section className="rounded-xl border border-border bg-card">
            <form
              method="get"
              className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end"
            >
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="audit-search"
                  className="mb-1.5 block text-[11px] font-medium text-muted-foreground"
                >
                  Search events
                </label>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="audit-search"
                    name="q"
                    defaultValue={q}
                    placeholder="Action, resource, ID, IP address, error code..."
                    className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-[12px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              </div>

              <div className="w-full lg:w-48">
                <label
                  htmlFor="audit-action"
                  className="mb-1.5 block text-[11px] font-medium text-muted-foreground"
                >
                  Action
                </label>

                <select
                  id="audit-action"
                  name="action"
                  defaultValue={action}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-[12px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">All actions</option>
                  {actionOptions.map((option) => (
                    <option key={option.action} value={option.action}>
                      {formatAction(option.action)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full lg:w-44">
                <label
                  htmlFor="audit-resource"
                  className="mb-1.5 block text-[11px] font-medium text-muted-foreground"
                >
                  Resource
                </label>

                <select
                  id="audit-resource"
                  name="resourceType"
                  defaultValue={resourceType}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-[12px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">All resources</option>
                  {resourceOptions.map((option) => (
                    <option
                      key={option.resourceType}
                      value={option.resourceType}
                    >
                      {formatAction(option.resourceType)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full lg:w-32">
                <label
                  htmlFor="audit-status"
                  className="mb-1.5 block text-[11px] font-medium text-muted-foreground"
                >
                  Result
                </label>

                <select
                  id="audit-status"
                  name="status"
                  defaultValue={status}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-[12px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">All results</option>
                  <option value="success">Successful</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                <Filter className="size-3.5" />
                Apply
              </button>

              {(q || action || resourceType || status) && (
                <Link
                  href="/platform/audit-logs"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-[12px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Clear
                </Link>
              )}
            </form>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[13px] font-semibold text-foreground">
                  Event history
                </h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {filteredCount === 0
                    ? "No events match the current filters."
                    : `Showing ${firstResult.toLocaleString()}–${lastResult.toLocaleString()} of ${filteredCount.toLocaleString()} events`}
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Clock3 className="size-3.5" />
                <span>Newest first</span>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <FileClock className="size-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  No audit events found
                </h3>
                <p className="mt-1 max-w-md text-[12px] leading-5 text-muted-foreground">
                  Try adjusting the search or filters. New platform activity
                  will appear here automatically as it is recorded.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Event
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Actor
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Resource
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        School
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Time
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Result
                      </th>
                      <th className="w-20 px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Details
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {logs.map((log) => {
                      const actor = log.actorId
                        ? actorMap.get(log.actorId)
                        : null;
                      const school = log.schoolId
                        ? schoolMap.get(log.schoolId)
                        : null;

                      return (
                        <tr
                          key={log.id}
                          className="align-top transition hover:bg-muted/20"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Activity className="size-3.5" />
                              </div>

                              <div className="min-w-0">
                                <p className="font-medium text-foreground">
                                  {formatAction(log.action)}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {formatAction(log.resourceType)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            {actor ? (
                              <div className="flex items-center gap-2.5">
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                                  {getInitials(actor.name, actor.email)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">
                                    {actor.name || "Unnamed user"}
                                  </p>
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {actor.email}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <UserRound className="size-3.5" />
                                <span>System</span>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {formatAction(log.resourceType)}
                              </p>
                              {log.resourceId && (
                                <p
                                  className="mt-0.5 font-mono text-[10px] text-muted-foreground"
                                  title={log.resourceId}
                                >
                                  {truncate(log.resourceId)}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            {school ? (
                              <div className="flex items-start gap-2">
                                <Building2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">
                                    {school.name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {school.code}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Platform
                              </span>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            <p className="font-medium text-foreground">
                              {formatDate(log.createdAt)}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatDateOnly(log.createdAt)}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            {log.success ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="size-3" />
                                Success
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-medium text-destructive">
                                <XCircle className="size-3" />
                                Failed
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <details className="group">
                              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
                                View
                                <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                              </summary>


                              <div className="relative z-50 mt-2 w-[min(560px,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 text-left shadow-xl">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-[13px] font-semibold text-foreground">
                                      Event details
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                      {formatAction(log.action)}
                                    </p>
                                  </div>

                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {log.id}
                                  </span>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                                    <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                                      Resource
                                    </p>
                                    <p className="mt-1 text-[11px] font-medium text-foreground">
                                      {formatAction(log.resourceType)}
                                    </p>
                                    {log.resourceId && (
                                      <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                                        {log.resourceId}
                                      </p>
                                    )}
                                  </div>

                                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                                    <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                                      Request
                                    </p>
                                    <p className="mt-1 text-[11px] text-foreground">
                                      {log.ipAddress || "No IP recorded"}
                                    </p>
                                    <p className="mt-1 break-all text-[10px] text-muted-foreground">
                                      {log.userAgent || "No user agent recorded"}
                                    </p>
                                  </div>
                                </div>

                                {log.errorCode && (
                                  <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                                    <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-destructive">
                                      Error
                                    </p>
                                    <p className="mt-1 font-mono text-[11px] text-destructive">
                                      {log.errorCode}
                                    </p>
                                  </div>
                                )}

                                <div className="mt-3">
                                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                                    Metadata
                                  </p>

                                  {log.metadata ? (
                                    <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-[10px] leading-5 text-foreground">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  ) : (
                                    <div className="rounded-lg border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">
                                      No metadata recorded.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </details>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {filteredCount > 0 && (
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted-foreground">
                  Page {currentPage.toLocaleString()} of{" "}
                  {totalPages.toLocaleString()}
                </p>

                <div className="flex items-center gap-2">
                  {currentPage > 1 ? (
                    <Link
                      href={pageHref(currentPage - 1)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[11px] font-medium text-foreground transition hover:bg-muted"
                    >
                      <ChevronLeft className="size-3.5" />
                      Previous
                    </Link>
                  ) : (
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 text-[11px] font-medium text-muted-foreground">
                      <ChevronLeft className="size-3.5" />
                      Previous
                    </span>
                  )}

                  {currentPage < totalPages ? (
                    <Link
                      href={pageHref(currentPage + 1)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[11px] font-medium text-foreground transition hover:bg-muted"
                    >
                      Next
                      <ChevronRight className="size-3.5" />
                    </Link>
                  ) : (
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 text-[11px] font-medium text-muted-foreground">
                      Next
                      <ChevronRight className="size-3.5" />
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </PlatformPageLayout>
    </PlatformShell>
  );
}
