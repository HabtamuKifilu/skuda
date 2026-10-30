import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleUserRound,
  Mail,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { PlatformPageLayout } from "@/components/platform-shell/platform-page";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

export default async function PlatformUsersPage() {
  await requirePlatformOwnerPage();

  const users = await prisma.user.findMany({
    orderBy: [
      { name: "asc" },
      { email: "asc" },
    ],
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      emailVerified: true,
      banned: true,
      createdAt: true,
    },
  });

  return (
    <PlatformShell>
      <PlatformPageLayout>
          <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Users className="size-4" />
                Platform
              </div>

              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Users
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Manage the people who have accounts on the SKUDA platform.
                School roles are assigned separately within each school.
              </p>
            </div>

            <Link
              href="/platform/users/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Create user
            </Link>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-5" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total users
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {users.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="size-5" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Active
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {users.filter((user) => !user.banned).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <ShieldCheck className="size-5" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Verified
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {users.filter((user) => user.emailVerified).length}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-6 py-5">
              <h2 className="text-sm font-semibold">Platform users</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Authentication accounts available for assignment to schools.
              </p>
            </div>

            {users.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
                  <CircleUserRound className="size-7 text-muted-foreground" />
                </div>

                <h3 className="mt-5 text-base font-semibold">
                  No users yet
                </h3>

                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Create the first SKUDA user account, then assign that user
                  as a school owner or manage their school membership.
                </p>

                <Link
                  href="/platform/users/new"
                  className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="size-4" />
                  Create first user
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-4 px-6 py-5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <UserRound className="size-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">
                            {user.name}
                          </p>

                          {user.banned ? (
                            <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                              Banned
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="size-3.5 shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-5 text-xs text-muted-foreground">
                      <div className="hidden items-center gap-1.5 sm:flex">
                        <ShieldCheck className="size-3.5" />
                        {user.emailVerified ? "Verified" : "Unverified"}
                      </div>

                      <div className="hidden md:block">
                        Created{" "}
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                        }).format(user.createdAt)}
                      </div>

                      <Link
                        href={`/platform/users/${user.id}`}
                        className="inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-primary"
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
      </PlatformPageLayout>
    </PlatformShell>
  );
}
