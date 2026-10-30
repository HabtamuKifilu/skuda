import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleUserRound,
  Users,
} from "lucide-react";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { PlatformPageLayout } from "@/components/platform-shell/platform-page";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

export default async function PlatformPage() {
  await requirePlatformOwnerPage();

  const [schoolCount, activeSchoolCount, userCount, schoolOwnerCount, recentSchools] =
    await Promise.all([
      prisma.school.count(),
      prisma.school.count({
        where: {
          isActive: true,
        },
      }),
      prisma.user.count(),
      prisma.schoolMembership.count({
        where: {
          role: "OWNER",
          isActive: true,
        },
      }),
      prisma.school.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          country: true,
          isActive: true,
          createdAt: true,
        },
      }),
    ]);

  const metrics = [
    {
      label: "Schools",
      value: schoolCount,
      description:
        schoolCount === 0
          ? "No schools registered yet"
          : `${activeSchoolCount} active ${
              activeSchoolCount === 1 ? "school" : "schools"
            }`,
      icon: Building2,
    },
    {
      label: "Active schools",
      value: activeSchoolCount,
      description:
        activeSchoolCount === 0
          ? "No active schools"
          : "Currently operating on SKUDA",
      icon: CheckCircle2,
    },
    {
      label: "Platform users",
      value: userCount,
      description:
        userCount === 0
          ? "No user accounts yet"
          : `${userCount === 1 ? "account" : "accounts"} registered`,
      icon: Users,
    },
    {
      label: "School owners",
      value: schoolOwnerCount,
      description:
        schoolOwnerCount === 0
          ? "No school owners assigned"
          : "Active school owner assignments",
      icon: CircleUserRound,
    },
  ];

  return (
    <PlatformShell>
      <PlatformPageLayout>
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-primary">
                Platform control plane
              </p>

              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Platform overview
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Monitor and manage the organizations and accounts operating on
                the SKUDA platform.
              </p>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <div
                  key={metric.label}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {metric.label}
                      </p>

                      <p className="mt-2 text-2xl font-semibold tracking-tight">
                        {metric.value}
                      </p>
                    </div>

                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-[18px]" strokeWidth={1.8} />
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {metric.description}
                  </p>
                </div>
              );
            })}
          </section>

          <section className="rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold">Recent schools</h2>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  The latest organizations registered on the SKUDA platform.
                </p>
              </div>

              <Link
                href="/platform/schools"
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-muted"
              >
                View all schools
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            {recentSchools.length === 0 ? (
              <div className="flex min-h-64 items-center justify-center px-6 py-10">
                <div className="max-w-sm text-center">
                  <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="size-5" strokeWidth={1.8} />
                  </div>

                  <h3 className="mt-4 text-sm font-semibold">
                    No schools registered
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Create the first school to start building its SKUDA
                    workspace.
                  </p>

                  <Link
                    href="/platform/schools/new"
                    className="mt-5 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    Create school
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentSchools.map((school) => (
                  <div
                    key={school.id}
                    className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="size-5" strokeWidth={1.8} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold">
                            {school.name}
                          </h3>

                          <span
                            className={
                              school.isActive
                                ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                                : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                            }
                          >
                            {school.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[school.code, school.city, school.country]
                            .filter(Boolean)
                            .join(" · ") || "No location details"}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      <span className="hidden text-xs text-muted-foreground md:inline">
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                        }).format(school.createdAt)}
                      </span>

                      <Link
                        href={`/platform/schools/${school.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-muted"
                      >
                        View
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/platform/schools"
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-5" strokeWidth={1.8} />
                </div>

                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>

              <h2 className="mt-4 text-sm font-semibold">Manage schools</h2>

              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Create schools, review their details, and manage school owner
                assignments.
              </p>
            </Link>

            <Link
              href="/platform/users"
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-5" strokeWidth={1.8} />
                </div>

                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>

              <h2 className="mt-4 text-sm font-semibold">Manage users</h2>

              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Manage platform accounts and prepare users for assignment to
                school workspaces.
              </p>
            </Link>
          </section>
        </PlatformPageLayout>
    </PlatformShell>
  );
}
