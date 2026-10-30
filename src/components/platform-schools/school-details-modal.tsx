"use client";

import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

type SchoolDetails = {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  timezone: string;
  currency: string;
  isActive: boolean;
  createdAt: string;
  students: number;
  staff: number;
  memberships: number;
  owner: {
    name: string;
    email: string;
    image: string | null;
  } | null;
};

type SchoolDetailsModalProps = {
  school: SchoolDetails | null;
  onClose: () => void;
};

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

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(date));
}

export function SchoolDetailsModal({
  school,
  onClose,
}: SchoolDetailsModalProps) {
  useEffect(() => {
    if (!school) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [school, onClose]);

  useEffect(() => {
    if (!school) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [school]);

  if (!school) {
    return null;
  }

  const location = [school.city, school.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="school-details-title"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-background"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-5" strokeWidth={1.8} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="school-details-title"
                  className="truncate text-base font-semibold tracking-tight"
                >
                  {school.name}
                </h2>

                <span
                  className={
                    school.isActive
                      ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                      : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
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
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                {school.code ?? "No school code"} · {school.slug}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close school details"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[min(70vh,680px)] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
            <div className="bg-background p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Students
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums">
                {school.students}
              </p>
            </div>

            <div className="bg-background p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Staff
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums">
                {school.staff}
              </p>
            </div>

            <div className="bg-background p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Members
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums">
                {school.memberships}
              </p>
            </div>

            <div className="bg-background p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Currency
              </p>
              <p className="mt-1.5 text-xl font-semibold">
                {school.currency}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              School information
            </h3>

            <div className="mt-3 divide-y divide-border rounded-xl border border-border">
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
                <span className="text-xs text-muted-foreground">Location</span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  {location || "Not provided"}
                </span>
              </div>

              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
                <span className="text-xs text-muted-foreground">Address</span>
                <span className="text-sm font-medium">
                  {school.address || "Not provided"}
                </span>
              </div>

              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
                <span className="text-xs text-muted-foreground">Email</span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="size-3.5 text-muted-foreground" />
                  {school.email || "Not provided"}
                </span>
              </div>

              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
                <span className="text-xs text-muted-foreground">Phone</span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Phone className="size-3.5 text-muted-foreground" />
                  {school.phone || "Not provided"}
                </span>
              </div>

              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
                <span className="text-xs text-muted-foreground">Timezone</span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Clock3 className="size-3.5 text-muted-foreground" />
                  {school.timezone}
                </span>
              </div>

              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:items-center">
                <span className="text-xs text-muted-foreground">Created</span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="size-3.5 text-muted-foreground" />
                  {formatDate(school.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              School owner
            </h3>

            <div className="mt-3 flex items-center gap-3 rounded-xl border border-border px-4 py-3">
              {school.owner ? (
                <>
                  <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {school.owner.image ? (
                      <img
                        src={school.owner.image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      getInitials(school.owner.name)
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {school.owner.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {school.owner.email}
                    </p>
                  </div>

                  <CheckCircle2 className="ml-auto size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                </>
              ) : (
                <>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Users className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No owner assigned</p>
                    <p className="text-xs text-muted-foreground">
                      Ownership still needs to be configured.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Close
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/platform/schools/${school.id}/edit`}
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              Edit school
            </Link>

            <Link
              href={`/platform/schools/${school.id}`}
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open full details
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
