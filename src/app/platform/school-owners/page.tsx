import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleUserRound,
  Crown,
  Mail,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

const PAGE_SIZE = 10;

type SchoolOwnersPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

function buildPageHref(q: string, page: number) {
  const params = new URLSearchParams();

  if (q) {
    params.set("q", q);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query
    ? `/platform/school-owners?${query}`
    : "/platform/school-owners";
}

export default async function SchoolOwnersPage({
  searchParams,
}: SchoolOwnersPageProps) {
  await requirePlatformOwnerPage();

  const { q: rawQuery, page: rawPage } = await searchParams;

  const query = rawQuery?.trim() ?? "";
  const parsedPage = Number.parseInt(rawPage ?? "1", 10);
  const page =
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const ownerWhere = {
    role: SchoolMembershipRole.OWNER,
    ...(query
      ? {
          OR: [
            {
              user: {
                name: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              user: {
                email: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              school: {
                name: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            },
            {
              school: {
                code: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            },
          ],
        }
      : {}),
  };

  const [
    totalOwners,
    activeOwners,
    inactiveOwners,
    totalSchools,
    schoolsWithOwners,
    filteredOwners,
  ] = await Promise.all([
    prisma.schoolMembership.count({
      where: {
        role: SchoolMembershipRole.OWNER,
      },
    }),
    prisma.schoolMembership.count({
      where: {
        role: SchoolMembershipRole.OWNER,
        isActive: true,
      },
    }),
    prisma.schoolMembership.count({
      where: {
        role: SchoolMembershipRole.OWNER,
        isActive: false,
      },
    }),
    prisma.school.count(),
    prisma.school.count({
      where: {
        memberships: {
          some: {
            role: SchoolMembershipRole.OWNER,
            isActive: true,
          },
        },
      },
    }),
    prisma.schoolMembership.count({ where: ownerWhere }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredOwners / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const owners = await prisma.schoolMembership.findMany({
    where: ownerWhere,
    orderBy: [
      {
        isActive: "desc",
      },
      {
        user: {
          name: "asc",
        },
      },
      {
        school: {
          name: "asc",
        },
      },
    ],
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          banned: true,
        },
      },
      school: {
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          country: true,
          isActive: true,
        },
      },
    },
  });

  const schoolsWithoutOwners = Math.max(
    0,
    totalSchools - schoolsWithOwners,
  );

  return (
    <PlatformShell>
      <div className="w-full px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
        <div className="flex flex-col gap-5">
          <section>
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Crown className="size-4" />
              Organization
            </div>

            <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  School Owners
                </h1>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Monitor the account responsible for administering each
                  school across the SKUDA platform.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Crown className="size-5" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Owner assignments
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {totalOwners}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-5" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Active owners
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {activeOwners}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Building2 className="size-5" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Schools without owner
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {schoolsWithoutOwners}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Users className="size-5" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Inactive assignments
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {inactiveOwners}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Owner directory</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Active ownership assignments across all schools.
                </p>
              </div>

              <form
                method="get"
                className="flex w-full max-w-md items-center gap-2"
              >
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                  <input
                    name="q"
                    defaultValue={query}
                    placeholder="Search owners or schools..."
                    className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Search
                </button>
              </form>
            </div>

            {owners.length === 0 ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                  {query ? (
                    <Search className="size-7 text-muted-foreground" />
                  ) : (
                    <CircleUserRound className="size-7 text-muted-foreground" />
                  )}
                </div>

                <h3 className="mt-5 text-base font-semibold">
                  {query ? "No owners found" : "No school owners yet"}
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {query
                    ? `No owner assignment matches “${query}”. Try a different name, email, school, or school code.`
                    : "No school currently has an owner assignment. Owners can be assigned from the individual school workspace."}
                </p>

                {query ? (
                  <Link
                    href="/platform/school-owners"
                    className="mt-6 inline-flex h-9 items-center rounded-lg border border-border bg-background px-3.5 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    Clear search
                  </Link>
                ) : null}
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {owners.map((owner) => {
                    const initials =
                      owner.user.name
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase())
                        .join("") || "U";

                    return (
                      <div
                        key={owner.id}
                        className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-muted/30 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {owner.user.image ? (
                              <img
                                src={owner.user.image}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              initials
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/platform/users/${owner.user.id}`}
                                className="truncate text-sm font-semibold hover:text-primary"
                              >
                                {owner.user.name}
                              </Link>

                              {owner.isActive ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                  <span className="size-1.5 rounded-full bg-current" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  Inactive
                                </span>
                              )}

                              {owner.user.banned ? (
                                <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                                  Banned
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                              <Mail className="size-3.5 shrink-0" />
                              <span className="truncate">
                                {owner.user.email}
                              </span>

                              <span className="hidden text-border sm:inline">
                                ·
                              </span>

                              <span className="hidden items-center gap-1.5 sm:inline-flex">
                                <ShieldCheck className="size-3.5" />
                                {owner.user.emailVerified
                                  ? "Verified"
                                  : "Unverified"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                          <Link
                            href={`/platform/schools/${owner.school.id}`}
                            className="group flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted"
                          >
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Building2 className="size-4" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium group-hover:text-primary">
                                {owner.school.name}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {owner.school.code || "No school code"}
                                {owner.school.city
                                  ? ` · ${owner.school.city}`
                                  : ""}
                              </p>
                            </div>

                            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                          </Link>

                          <div className="hidden h-8 w-px bg-border sm:block" />

                          <div className="hidden items-center gap-2 text-xs text-muted-foreground xl:flex">
                            <UserRound className="size-3.5" />
                            Owner since{" "}
                            {new Intl.DateTimeFormat("en", {
                              dateStyle: "medium",
                            }).format(owner.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 ? (
                  <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Showing{" "}
                      {(currentPage - 1) * PAGE_SIZE + 1}–{" "}
                      {Math.min(currentPage * PAGE_SIZE, filteredOwners)} of{" "}
                      {filteredOwners} owner assignments
                    </p>

                    <div className="flex items-center gap-2">
                      {currentPage > 1 ? (
                        <Link
                          href={buildPageHref(query, currentPage - 1)}
                          className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
                        >
                          Previous
                        </Link>
                      ) : (
                        <span className="inline-flex h-8 items-center rounded-lg border border-border bg-muted/40 px-3 text-xs font-medium text-muted-foreground">
                          Previous
                        </span>
                      )}

                      <span className="px-2 text-xs text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>

                      {currentPage < totalPages ? (
                        <Link
                          href={buildPageHref(query, currentPage + 1)}
                          className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
                        >
                          Next
                        </Link>
                      ) : (
                        <span className="inline-flex h-8 items-center rounded-lg border border-border bg-muted/40 px-3 text-xs font-medium text-muted-foreground">
                          Next
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </PlatformShell>
  );
}
