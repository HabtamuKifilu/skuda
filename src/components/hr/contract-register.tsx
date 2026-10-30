"use client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ContractDocument = {
  id: string;
  title: string;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  issueDate: string | null;
  expiryDate: string | null;
  createdAt: string;
};

type StaffRow = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
  status: string;
  employment: {
    id: string;
    employmentType: string;
    startDate: string | null;
    contractStartDate: string | null;
    contractEndDate: string | null;
    contractReference: string | null;
  } | null;
  documents: ContractDocument[];
};

type Filter =
  | "ALL"
  | "EXPIRING"
  | "EXPIRED"
  | "MISSING_DOCUMENT"
  | "MISSING_DATES";

const inputClass =
  "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? null;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function daysUntil(value: string | null | undefined): number | null {
  const key = dateKey(value);
  if (!key) return null;

  const [year, month, day] = key.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = todayKey().split("-").map(Number);

  const target = Date.UTC(year, month - 1, day);
  const today = Date.UTC(todayYear, todayMonth - 1, todayDay);

  return Math.round((target - today) / 86_400_000);
}

function formatDate(value: string | null | undefined) {
  const key = dateKey(value);
  if (!key) return "Not recorded";

  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function humanize(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fixedTerm(row: StaffRow) {
  return ["CONTRACT", "TEMPORARY", "PART_TIME", "PROBATION"].includes(
    row.employment?.employmentType ?? "",
  );
}

function missingDates(row: StaffRow) {
  if (!row.employment) return true;
  if (!fixedTerm(row)) return false;

  return (
    !row.employment.contractStartDate ||
    !row.employment.contractEndDate
  );
}

function expiryLabel(row: StaffRow) {
  const endDate = row.employment?.contractEndDate;
  const remaining = daysUntil(endDate);

  if (remaining === null) {
    return { label: "No end date", className: "bg-muted text-muted-foreground" };
  }
  if (remaining < 0) {
    return {
      label: `Expired ${Math.abs(remaining)}d ago`,
      className: "border-red-600/20 bg-red-600/10 text-red-700 dark:text-red-300",
    };
  }
  if (remaining === 0) {
    return {
      label: "Expires today",
      className: "border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300",
    };
  }
  if (remaining <= 30) {
    return {
      label: `${remaining} days left`,
      className: "border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300",
    };
  }
  return {
    label: `${remaining} days left`,
    className: "border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
  };
}

function documentLabel(row: StaffRow) {
  const latest = row.documents[0];

  if (!latest) {
    return {
      label: "Missing document",
      className: "border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300",
    };
  }
  if (latest.reviewStatus === "PENDING") {
    return {
      label: "Pending review",
      className: "border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300",
    };
  }
  if (latest.reviewStatus === "REJECTED") {
    return {
      label: "Rejected",
      className: "border-red-600/20 bg-red-600/10 text-red-700 dark:text-red-300",
    };
  }
  return {
    label: "Reviewed",
    className: "border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
  };
}

function employeeName(row: StaffRow) {
  return [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" ");
}

export function ContractRegister({ schoolId }: { schoolId: string }) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/schools/${schoolId}/contracts`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        staff?: StaffRow[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load contracts.");
      }

      setStaff(payload.staff ?? []);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load contracts.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const today = todayKey();

    return {
      employees: staff.length,
      dated: staff.filter((row) => Boolean(row.employment?.contractEndDate)).length,
      expiring: staff.filter((row) => {
        const days = daysUntil(row.employment?.contractEndDate);
        return days !== null && days >= 0 && days <= 30;
      }).length,
      expired: staff.filter((row) => {
        const days = daysUntil(row.employment?.contractEndDate);
        return days !== null && days < 0;
      }).length,
      missingDocuments: staff.filter((row) => row.documents.length === 0).length,
    };
  }, [staff]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    return staff.filter((row) => {
      const employment = row.employment;
      const days = daysUntil(employment?.contractEndDate);

      const matchesSearch =
        !query ||
        [
          employeeName(row),
          row.employeeNumber,
          row.jobTitle,
          row.department,
          employment?.contractReference,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      if (!matchesSearch) return false;

      switch (filter) {
        case "EXPIRING":
          return days !== null && days >= 0 && days <= 30;
        case "EXPIRED":
          return days !== null && days < 0;
        case "MISSING_DOCUMENT":
          return row.documents.length === 0;
        case "MISSING_DATES":
          return missingDates(row);
        default:
          return true;
      }
    });
  }, [staff, search, filter]);

  const summary = [
    {
      label: "Employees",
      value: counts.employees,
      detail: "In this school",
      icon: Users,
    },
    {
      label: "Contracts with end dates",
      value: counts.dated,
      detail: "Dates recorded",
      icon: CalendarDays,
    },
    {
      label: "Expiring in 30 days",
      value: counts.expiring,
      detail: "Including today",
      icon: Clock3,
    },
    {
      label: "Expired contracts",
      value: counts.expired,
      detail: "Past end date",
      icon: AlertCircle,
    },
  ];

  return (
    <div className="w-full space-y-5 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Contracts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Employment dates, expiry deadlines, and contract-document status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 font-medium hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-3 text-2xl font-semibold tabular-nums">
                {loading ? "—" : item.value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employee, number, role, department..."
            aria-label="Search contracts"
            className={`${inputClass} w-full pl-9`}
          />
        </div>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as Filter)}
          aria-label="Filter contracts"
          className={`${inputClass} min-w-[190px]`}
        >
          <option value="ALL">All employees</option>
          <option value="EXPIRING">Expiring in 30 days</option>
          <option value="EXPIRED">Expired contracts</option>
          <option value="MISSING_DOCUMENT">Missing contract document</option>
          <option value="MISSING_DATES">Missing employment dates</option>
        </select>
        <span className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${filteredStaff.length} of ${staff.length} employees`}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-600/20 bg-red-600/5 p-4 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">{error}</div>
          <button type="button" onClick={() => void load()} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="font-semibold">Employee contract register</div>
          <div className="text-xs text-muted-foreground">
            {counts.missingDocuments} missing contract documents
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Job assignment</th>
                <th className="px-4 py-3 font-medium">Employment type</th>
                <th className="px-4 py-3 font-medium">Contract period</th>
                <th className="px-4 py-3 font-medium">Expiry</th>
                <th className="px-4 py-3 font-medium">Contract document</th>
                <th className="px-4 py-3 font-medium">Employee status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Loading contract records…
                  </td>
                </tr>
              )}

              {!loading && !error && filteredStaff.map((row) => {
                const employment = row.employment;
                const expiry = expiryLabel(row);
                const document = documentLabel(row);
                const hasMissingDates = missingDates(row);

                return (
                  <tr key={row.id} className="align-top hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{employeeName(row)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.employeeNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{row.jobTitle || "No job title"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.department || "No department"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {employment ? humanize(employment.employmentType) : "Not recorded"}
                      {employment?.contractReference && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Ref: {employment.contractReference}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {formatDate(employment?.contractStartDate ?? employment?.startDate)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        to {formatDate(employment?.contractEndDate)}
                      </div>
                      {hasMissingDates && (
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          {employment ? "Dates incomplete" : "Employment record missing"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${expiry.className}`}>
                        {expiry.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${document.className}`}>
                        {document.label}
                      </span>
                      {row.documents[0]?.title && (
                        <div className="mt-1 max-w-[170px] truncate text-xs text-muted-foreground">
                          {row.documents[0].title}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{humanize(row.status)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/hr/employees/${row.id}`}
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        View employee
                        <FileText className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {!loading && !error && filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <CheckCircle2 className="mx-auto size-6 text-muted-foreground" />
                    <p className="mt-2 font-medium">No matching contract records</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Try another search or filter.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        This register reports recorded dates and document-review status. It does not approve contract renewals, salary commitments, job changes, or termination decisions.
      </p>
    </div>
  );
}
