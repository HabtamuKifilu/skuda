import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleOff,
  Crown,
  Globe2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PlatformShell } from "@/components/platform-shell/platform-shell";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-page";

type SchoolDetailPageProps = {
  params: Promise<{
    schoolId: string;
  }>;
};

export default async function SchoolDetailPage({
  params,
}: SchoolDetailPageProps) {
  await requirePlatformOwnerPage();

  const { schoolId } = await params;

  const school = await prisma.school.findUnique({
    where: {
      id: schoolId,
    },
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
      timezone: true,
      currency: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
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
        select: {
          id: true,
          role: true,
          isActive: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!school) {
    notFound();
  }

  const owner = school.memberships[0] ?? null;

  const location = [school.city, school.country]
    .filter(Boolean)
    .join(", ");

  return (
    <PlatformShell>
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <section>
            <Link
              href="/platform/schools"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to schools
            </Link>

            <div className="mt-5 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="size-6" strokeWidth={1.8} />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-primary">
                      Organization
                    </p>

                    <span
                      className={
                        school.isActive
                          ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                          : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                      }
                    >
                      {school.isActive ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <CircleOff className="size-3" />
                      )}
                      {school.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                    {school.name}
                  </h1>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {school.slug}
                  </p>
                </div>
              </div>

              <Link
                href={`/platform/schools/${school.id}/edit`}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
              >
                <Pencil className="size-4" />
                Edit school
              </Link>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "School members",
                value: school._count.memberships,
                icon: UserRound,
              },
              {
                label: "Students",
                value: school._count.students,
                icon: UserRound,
              },
              {
                label: "Staff",
                value: school._count.staffProfiles,
                icon: ShieldCheck,
              },
              {
                label: "Currency",
                value: school.currency,
                icon: Globe2,
              },
            ].map((metric) => {
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
                </div>
              );
            })}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold">School information</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Core organization details and platform configuration.
                </p>
              </div>

              <div className="grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    School code
                  </p>
                  <p className="mt-1 text-sm">
                    {school.code || "Not configured"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Location
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <MapPin className="size-4 text-muted-foreground" />
                    <span>{location || "Not configured"}</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Email
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-muted-foreground" />
                    <span>{school.email || "Not configured"}</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Phone
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Phone className="size-4 text-muted-foreground" />
                    <span>{school.phone || "Not configured"}</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Address
                  </p>
                  <p className="mt-1 text-sm">
                    {school.address || "Not configured"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Country
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Globe2 className="size-4 text-muted-foreground" />
                    <span>{school.country}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold">Platform settings</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Runtime defaults for this school.
                </p>
              </div>

              <div className="space-y-1 p-3">
                <div className="flex items-center justify-between rounded-lg px-3 py-3">
                  <span className="text-sm">Timezone</span>
                  <span className="text-xs text-muted-foreground">
                    {school.timezone}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg px-3 py-3">
                  <span className="text-sm">Currency</span>
                  <span className="text-xs text-muted-foreground">
                    {school.currency}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg px-3 py-3">
                  <span className="text-sm">Created</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    {school.createdAt.toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg px-3 py-3">
                  <span className="text-sm">Status</span>
                  <span
                    className={
                      school.isActive
                        ? "inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                        : "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                    }
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {school.isActive ? "Operational" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Crown className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">School owner</h2>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The person responsible for administering this school in
                  SKUDA.
                </p>
              </div>

              {!owner ? (
                <Link
                  href={`/platform/schools/${school.id}/members/new`}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  <Crown className="size-4" />
                  Assign school owner
                </Link>
              ) : null}
            </div>

            {owner ? (
              <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {owner.user.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {owner.user.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {owner.user.email}
                    </p>
                  </div>
                </div>

                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  <Crown className="size-3" />
                  School Owner
                </span>
              </div>
            ) : (
              <div className="px-5 py-8">
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-5 py-6 text-center">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
                    <Crown className="size-5 text-muted-foreground" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">
                    No school owner assigned
                  </h3>
                  <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
                    Assign the person who will administer this school. School
                    staff and other members can be managed later from the
                    school workspace.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </PlatformShell>
  );
}
