import Link from "next/link";
import {

  Building2,
  ArrowRight,
  CheckCircle2,

  CircleOff,
  Edit3,
  MapPin,
  Plus,
  Search,
  Users,
  X,
  UserRound,
} from "lucide-react";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { PlatformPageLayout } from "@/components/platform-shell/platform-page";
import { SchoolsTableToolbar } from "@/components/platform-schools/schools-table-toolbar";
import { SchoolDetailsModalTrigger } from "@/components/platform-schools/school-details-modal-trigger";
import { SchoolsPagination } from "@/components/platform-schools/schools-pagination";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

type PlatformSchoolsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    page?: string | string[];
  }>;
};

function getSearchParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "SC";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default async function PlatformSchoolsPage({
  searchParams,
}: PlatformSchoolsPageProps) {
  await requirePlatformOwnerPage();

  const params = await searchParams;
  const query = getSearchParam(params.q).trim();
  const status = getSearchParam(params.status);
  const requestedPage = Number.parseInt(getSearchParam(params.page), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 10;

  const schoolWhere = {
    ...(query
      ? {
          OR: [
            {
              name: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              code: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              city: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              country: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(status === "active"
      ? {
          isActive: true,
        }
      : status === "inactive"
        ? {
            isActive: false,
          }
        : {}),
  };

  const [allSchoolCount, activeCount, inactiveCount, filteredSchoolCount, schools] =
    await Promise.all([
      prisma.school.count(),
      prisma.school.count({
        where: {
          isActive: true,
        },
      }),
      prisma.school.count({
        where: {
          isActive: false,
        },
      }),
      prisma.school.count({
        where: schoolWhere,
      }),
      prisma.school.findMany({
        where: schoolWhere,
        orderBy: {
          name: "asc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
          isActive: true,
          timezone: true,
          currency: true,
          createdAt: true,
          _count: {
            select: {
              memberships: true,
              students: true,
              staffProfiles: true,
            },
          },
          memberships: {
            where: {
              role: "OWNER",
              isActive: true,
            },
            take: 1,
            select: {
              user: {
                select: {
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
      }),
    ]);

  const hasFilters = Boolean(query || status);
  const totalPages = Math.max(1, Math.ceil(filteredSchoolCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const resultLabel =
    schools.length === 1 ? "school" : "schools";

  return (
    <PlatformShell>
      <PlatformPageLayout>
          <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Building2 className="size-4" strokeWidth={1.8} />
                Organization
              </div>

              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Schools
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Manage school organizations, ownership, operational status,
                and platform configuration from one place.
              </p>
            </div>

            <Link
              href="/platform/schools/new"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Create school
            </Link>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
              <div className="absolute right-0 top-0 size-24 -translate-y-8 translate-x-8 rounded-full bg-primary/5" />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Total schools
                  </p>

                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    {allSchoolCount}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Registered organizations
                  </p>
                </div>

                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-5" strokeWidth={1.8} />
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
              <div className="absolute right-0 top-0 size-24 -translate-y-8 translate-x-8 rounded-full bg-emerald-500/5" />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Active
                  </p>

                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-3xl font-semibold tracking-tight">
                      {activeCount}
                    </p>

                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {allSchoolCount > 0
                        ? `${Math.round(
                            (activeCount / allSchoolCount) * 100,
                          )}%`
                        : "0%"}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Currently operational
                  </p>
                </div>

                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-5" strokeWidth={1.8} />
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
              <div className="absolute right-0 top-0 size-24 -translate-y-8 translate-x-8 rounded-full bg-muted" />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Inactive
                  </p>

                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    {inactiveCount}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Not currently operational
                  </p>
                </div>

                <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <CircleOff className="size-5" strokeWidth={1.8} />
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl bg-card">
            <div className="border-b border-border px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">
                      School organizations
                    </h2>

                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {schools.length}
                    </span>
                  </div>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {hasFilters
                      ? `Showing ${schools.length} matching ${resultLabel}.`
                      : `${allSchoolCount} ${
                          allSchoolCount === 1 ? "school" : "schools"
                        } registered on the SKUDA platform.`}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {activeCount} active organizations
                </div>
              </div>
            </div>

            <div className="px-5 py-3">
              <SchoolsTableToolbar
                initialQuery={query}
                initialStatus={status}
              />
            </div>

            {schools.length === 0 ? (
              <div className="flex min-h-80 items-center justify-center px-6 py-12">
                <div className="max-w-md text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {hasFilters ? (
                      <Search className="size-6" strokeWidth={1.8} />
                    ) : (
                      <Building2 className="size-6" strokeWidth={1.8} />
                    )}
                  </div>

                  <h3 className="mt-5 text-base font-semibold">
                    {hasFilters
                      ? "No matching schools"
                      : "No schools yet"}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {hasFilters
                      ? "Try a different search term or clear the filters to see all registered schools."
                      : "Create your first school to begin setting up its academic, operational, and administrative workspace."}
                  </p>

                  {hasFilters ? (
                    <Link
                      href="/platform/schools"
                      className="mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      Clear filters
                      <X className="size-4" />
                    </Link>
                  ) : (
                    <Link
                      href="/platform/schools/new"
                      className="mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Create your first school
                      <ArrowRight className="size-4" />
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-left">
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        School
                      </th>

                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Status
                      </th>

                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Owner
                      </th>

                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Students
                      </th>

                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Staff
                      </th>

                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Created
                      </th>

                      <th className="w-28 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {schools.map((school) => {
                      const owner = school.memberships[0]?.user ?? null;
                      const location = [school.city, school.country]
                        .filter(Boolean)
                        .join(", ");

                      return (
                        <tr
                          key={school.id}
                          className="group transition-colors hover:bg-muted/30"
                        >
                          <td className="px-5 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Building2
                                  className="size-5"
                                  strokeWidth={1.8}
                                />
                              </div>

                              <div className="min-w-0">
                                <Link
                                  href={`/platform/schools/${school.id}`}
                                  className="block truncate font-semibold tracking-tight transition-colors hover:text-primary"
                                >
                                  {school.name}
                                </Link>

                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                  {school.code ? (
                                    <span className="font-medium">
                                      {school.code}
                                    </span>
                                  ) : (
                                    <span>No code</span>
                                  )}

                                  {location ? (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="size-3" />
                                        {location}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={
                                school.isActive
                                  ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                                  : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                              }
                            >
                              <span
                                className={
                                  school.isActive
                                    ? "size-1.5 rounded-full bg-emerald-500"
                                    : "size-1.5 rounded-full bg-muted-foreground"
                                }
                              />
                              {school.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            {owner ? (
                              <div className="flex min-w-44 items-center gap-2.5">
                                <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                  {owner.image ? (
                                    <img
                                      src={owner.image}
                                      alt=""
                                      className="size-full object-cover"
                                    />
                                  ) : (
                                    getInitials(owner.name)
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium">
                                    {owner.name}
                                  </p>
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    School owner
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                                  <UserRound className="size-3.5" />
                                </div>
                                No owner assigned
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-4 text-right">
                            <span className="font-medium tabular-nums">
                              {school._count.students}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-right">
                            <span className="font-medium tabular-nums">
                              {school._count.staffProfiles}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <div>
                              <p className="text-xs font-medium">
                                {formatDate(school.createdAt)}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {school.slug}
                              </p>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <SchoolDetailsModalTrigger
                                school={{
                                  id: school.id,
                                  name: school.name,
                                  slug: school.slug,
                                  code: school.code,
                                  email: school.email,
                                  phone: school.phone,
                                  address: school.address,
                                  city: school.city,
                                  country: school.country,
                                  timezone: school.timezone,
                                  currency: school.currency,
                                  isActive: school.isActive,
                                  createdAt: school.createdAt.toISOString(),
                                  students: school._count.students,
                                  staff: school._count.staffProfiles,
                                  memberships: school._count.memberships,
                                  owner: owner
                                    ? {
                                        name: owner.name,
                                        email: owner.email,
                                        image: owner.image,
                                      }
                                    : null,
                                }}
                              />

                              <Link
                                href={`/platform/schools/${school.id}/edit`}
                                aria-label={`Edit ${school.name}`}
                                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <Edit3 className="size-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {schools.length > 0 ? (
              <SchoolsPagination
                page={currentPage}
                pageSize={pageSize}
                total={filteredSchoolCount}
                query={query}
                status={status}
              />
            ) : null}
          </section>
        </PlatformPageLayout>
    </PlatformShell>
  );
}
