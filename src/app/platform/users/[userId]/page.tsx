import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <span className="size-1.5 rounded-full bg-emerald-500" />
      {activeLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" />
      {inactiveLabel}
    </span>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserRound;
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

export default async function PlatformUserDetailsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requirePlatformOwnerPage();

  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      emailVerified: true,
      role: true,
      banned: true,
      banReason: true,
      banExpires: true,
      createdAt: true,
      updatedAt: true,

      platformMemberships: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },

      memberships: {
        orderBy: [
          {
            school: {
              name: "asc",
            },
          },
          {
            role: "asc",
          },
        ],
        select: {
          id: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          school: {
            select: {
              id: true,
              name: true,
              code: true,
              city: true,
              country: true,
            },
          },
        },
      },

      sessions: {
        orderBy: {
          updatedAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          expiresAt: true,
          ipAddress: true,
          userAgent: true,
          impersonatedBy: true,
        },
      },

      accounts: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          providerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const activeSchoolMemberships = user.memberships.filter(
    (membership) => membership.isActive,
  ).length;

  const activePlatformMemberships = user.platformMemberships.filter(
    (membership) => membership.isActive,
  ).length;

  const latestSession = user.sessions[0] ?? null;

  return (
    <PlatformShell>
      <div className="w-full px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
        <div className="flex flex-col gap-5">
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
                    {user.image ? (
                      <img
                        src={user.image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      getInitials(user.name)
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="truncate text-[21px] font-semibold tracking-tight sm:text-[23px]">
                        {user.name}
                      </h1>

                      {user.banned ? (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                          Banned
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="size-3.5" />
                        {user.email}
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />
                        Joined {formatDateOnly(user.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {user.emailVerified ? (
                    <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 text-xs font-medium text-emerald-700">
                      <BadgeCheck className="size-4" />
                      Email verified
                    </span>
                  ) : (
                    <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 text-xs font-medium text-amber-700">
                      <Clock3 className="size-4" />
                      Email unverified
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid border-t border-border sm:grid-cols-4">
              <div className="border-b border-border px-5 py-4 sm:border-b-0 sm:border-r">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  School access
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {activeSchoolMemberships}
                </p>
                <p className="text-xs text-muted-foreground">
                  active memberships
                </p>
              </div>

              <div className="border-b border-border px-5 py-4 sm:border-b-0 sm:border-r">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  Platform access
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {activePlatformMemberships}
                </p>
                <p className="text-xs text-muted-foreground">
                  active memberships
                </p>
              </div>

              <div className="border-b border-border px-5 py-4 sm:border-b-0 sm:border-r">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  Sessions
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {user.sessions.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  recent sessions shown
                </p>
              </div>

              <div className="px-5 py-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  Last activity
                </p>
                <p className="mt-1 text-[13px] font-semibold">
                  {latestSession
                    ? formatDate(latestSession.updatedAt)
                    : "No sessions"}
                </p>
                <p className="text-xs text-muted-foreground">
                  latest session update
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
            <div className="flex min-w-0 flex-col gap-5">
              <Section
                icon={UserRound}
                title="Account overview"
                description="Core identity and account lifecycle information."
              >
                <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="space-y-4 p-4 sm:p-5">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Full name
                      </p>
                      <p className="mt-1 text-[13px] font-medium">{user.name}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="mt-1 break-all text-[13px] font-medium">
                        {user.email}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Email verification
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[13px] font-medium">
                        {user.emailVerified ? (
                          <>
                            <CheckCircle2 className="size-4 text-emerald-600" />
                            Verified
                          </>
                        ) : (
                          <>
                            <XCircle className="size-4 text-amber-600" />
                            Unverified
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 sm:p-5">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        User ID
                      </p>
                      <p className="mt-1 break-all font-mono text-xs">
                        {user.id}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Created
                      </p>
                      <p className="mt-1 text-[13px] font-medium">
                        {formatDate(user.createdAt)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Last updated
                      </p>
                      <p className="mt-1 text-[13px] font-medium">
                        {formatDate(user.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </Section>

              <Section
                icon={ShieldCheck}
                title="Platform access"
                description="Global SKUDA control-plane permissions assigned to this account."
              >
                {user.platformMemberships.length === 0 ? (
                  <div className="px-5 py-10 text-center sm:px-6">
                    <ShieldCheck className="mx-auto size-8 text-muted-foreground/50" />
                    <p className="mt-3 text-[13px] font-medium">
                      No platform memberships
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This account does not currently have platform-level
                      access.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {user.platformMemberships.map((membership) => (
                      <div
                        key={membership.id}
                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ShieldCheck className="size-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold">
                              {membership.role.replaceAll("_", " ")}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Granted {formatDateOnly(membership.createdAt)}
                            </p>
                          </div>
                        </div>

                        <StatusBadge active={membership.isActive} />
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section
                icon={Building2}
                title="School access"
                description="School-level roles and tenant memberships assigned to this account."
              >
                {user.memberships.length === 0 ? (
                  <div className="px-5 py-10 text-center sm:px-6">
                    <Building2 className="mx-auto size-8 text-muted-foreground/50" />
                    <p className="mt-3 text-[13px] font-medium">
                      No school memberships
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This account has not been assigned to a school.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {user.memberships.map((membership) => (
                      <div
                        key={membership.id}
                        className="flex flex-col gap-3 px-4 py-3.5 sm:px-5"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <Building2 className="size-4 text-muted-foreground" />
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold">
                                {membership.school.name}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {membership.school.code ?? "No school code"}
                                {membership.school.city
                                  ? ` · ${membership.school.city}`
                                  : ""}
                              </p>
                            </div>
                          </div>

                          <StatusBadge active={membership.isActive} />
                        </div>

                        <div className="ml-12 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {membership.role.replaceAll("_", " ")}
                          </span>
                          <span>
                            Joined {formatDateOnly(membership.createdAt)}
                          </span>
                          <span>
                            Updated {formatDateOnly(membership.updatedAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <Section
                icon={KeyRound}
                title="Security"
                description="Authentication state and account protection."
              >
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="text-[13px] font-medium">Account status</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Whether sign-in is currently restricted.
                      </p>
                    </div>
                    <StatusBadge
                      active={!user.banned}
                      activeLabel="Active"
                      inactiveLabel="Banned"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="text-[13px] font-medium">Email verification</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Verification status for the primary email.
                      </p>
                    </div>
                    {user.emailVerified ? (
                      <CheckCircle2 className="size-5 text-emerald-600" />
                    ) : (
                      <XCircle className="size-5 text-amber-600" />
                    )}
                  </div>

                  {user.banned ? (
                    <>
                      <div className="px-5 py-4">
                        <p className="text-xs text-muted-foreground">
                          Ban reason
                        </p>
                        <p className="mt-1 text-[13px] font-medium">
                          {user.banReason || "No reason provided"}
                        </p>
                      </div>

                      <div className="px-5 py-4">
                        <p className="text-xs text-muted-foreground">
                          Ban expiry
                        </p>
                        <p className="mt-1 text-[13px] font-medium">
                          {user.banExpires
                            ? formatDate(user.banExpires)
                            : "Permanent"}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              </Section>

              <Section
                icon={KeyRound}
                title="Authentication"
                description="Authentication providers linked to this account."
              >
                {user.accounts.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-[13px] font-medium">
                      No authentication providers
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {user.accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between gap-4 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium">
                            {account.providerId}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Connected {formatDateOnly(account.createdAt)}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                          Linked
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section
                icon={Activity}
                title="Recent sessions"
                description="Recent authentication sessions. Sensitive session tokens are never displayed."
              >
                {user.sessions.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-[13px] font-medium">No sessions</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This account has no recorded authentication sessions.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {user.sessions.slice(0, 5).map((session) => (
                      <div key={session.id} className="px-5 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[13px] font-medium">
                            {session.ipAddress || "Unknown IP"}
                          </p>

                          <span className="text-[11px] text-muted-foreground">
                            {formatDateOnly(session.updatedAt)}
                          </span>
                        </div>

                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {session.userAgent || "Unknown device"}
                        </p>

                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Expires {formatDate(session.expiresAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <section className="rounded-xl border border-border bg-muted/20 p-5">
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

                  <div>
                    <p className="text-[13px] font-semibold">
                      Account administration
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Role changes, session revocation, impersonation, and
                      account restrictions should be performed through audited
                      platform administration actions.
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
