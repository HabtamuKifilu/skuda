"use client";

import {
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  UserCheck,
  UserMinus,
  UserRoundX,
  RefreshCw,
  Plus,
  ArrowRightLeft,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmployeeCreateDialog } from "@/components/hr/employee-create-dialog";
import { EmployeeStatusDialog } from "@/components/hr/employee-status-dialog";

const statuses = [
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "TERMINATED",
  "INACTIVE",
] as const;

type StaffStatus = (typeof statuses)[number];

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  status: StaffStatus;
  hireDate: string | null;
};

type DirectoryResponse = {
  staff: Employee[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  statusCounts: Record<StaffStatus, number>;
  departments: string[];
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

const statusLabels: Record<StaffStatus, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  SUSPENDED: "Suspended",
  TERMINATED: "Terminated",
  INACTIVE: "Inactive",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function employeeName(employee: Employee) {
  return [
    employee.firstName,
    employee.middleName,
    employee.lastName,
  ].filter(Boolean).join(" ");
}

function statusClass(status: StaffStatus) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300";
    case "ON_LEAVE":
      return "border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300";
    case "SUSPENDED":
    case "TERMINATED":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function EmployeeDirectory({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [statusEmployee, setStatusEmployee] = useState<Employee | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [notice, setNotice] = useState("");

  const loadEmployees = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
    });
    if (search.trim()) params.set("q", search.trim());
    if (status) params.set("status", status);
    if (department) params.set("department", department);

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/staff?${params.toString()}`,
        { cache: "no-store", signal },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Unable to load the employee directory.",
        );
      }

      setData(result as DirectoryResponse);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the employee directory.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [schoolId, page, search, status, department]);

  useEffect(() => {
    const controller = new AbortController();
    void loadEmployees(controller.signal);
    return () => controller.abort();
  }, [loadEmployees, reloadToken]);

  const counts = data?.statusCounts;
  const totalEmployees = counts
    ? Object.values(counts).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">People &amp; HR</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Employee directory
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Find employees and review their current employment status,
              department, and contact details.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            <Plus className="size-4" />
            Add employee
          </button>
          <button
            type="button"
            onClick={() => void loadEmployees()}
            disabled={loading}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="All employees"
          value={counts ? totalEmployees : "—"}
          detail="School staff records"
          icon={<Users className="size-4" />}
        />
        <SummaryCard
          label="Active"
          value={counts?.ACTIVE ?? "—"}
          detail="Currently active"
          icon={<UserCheck className="size-4" />}
        />
        <SummaryCard
          label="On leave"
          value={counts?.ON_LEAVE ?? "—"}
          detail="Recorded leave status"
          icon={<UserMinus className="size-4" />}
        />
        <SummaryCard
          label="Suspended"
          value={counts?.SUSPENDED ?? "—"}
          detail="Suspended records"
          icon={<UserRoundX className="size-4" />}
        />
        <SummaryCard
          label="Other statuses"
          value={counts ? counts.TERMINATED + counts.INACTIVE : "—"}
          detail="Terminated or inactive"
          icon={<BriefcaseBusiness className="size-4" />}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 className="font-semibold">Employee records</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search by name, employee number, email, job title, or department.
          </p>
        </div>

        <div className="grid gap-3 border-b border-border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_200px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search employees"
              placeholder="Search employees..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className={`${inputClass} pl-9`}
            />
          </div>
          <select
            aria-label="Filter by employment status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>{statusLabels[item]}</option>
            ))}
          </select>
          <select
            aria-label="Filter by department"
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All departments</option>
            {(data?.departments ?? []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        {error ? (
          <div className="m-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4" role="alert">
            <p className="font-medium text-destructive">Could not load employees</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => void loadEmployees()}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Employee no.</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Job title</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Hire date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && !data ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center text-sm text-muted-foreground">
                    Loading employee records…
                  </td>
                </tr>
              ) : null}

              {!loading && !error && data?.staff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center">
                    <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Users className="size-5" />
                    </div>
                    <p className="mt-3 font-medium">No employees found</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {search || status || department
                        ? "Try changing or clearing your filters."
                        : "Add your first employee directly from this directory."}
                    </p>
                    {search || status || department ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setStatus("");
                          setDepartment("");
                          setPage(1);
                        }}
                        className="mt-3 text-sm font-medium text-primary hover:underline"
                      >
                        Clear filters
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : null}

              {data?.staff.map((employee) => (
                <tr key={employee.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-5 py-4">
                    <p className="font-medium"><a href={`/hr/employees/${encodeURIComponent(employee.id)}`} className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">{employeeName(employee)}</a></p>
                    <p className="mt-1 text-xs text-muted-foreground">{employee.email || "No email recorded"}</p>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs">{employee.employeeNumber}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-2">
                      <Building2 className="size-3.5 text-muted-foreground" />
                      {employee.department || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-4">{employee.jobTitle || "—"}</td>
                  <td className="px-4 py-4">{employee.phone || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-4">{formatDate(employee.hireDate)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(employee.status)}`}>
                      {statusLabels[employee.status] ?? employee.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setStatusEmployee(employee)}
                      className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border bg-background px-3 text-xs font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      aria-label={`Manage status for ${employeeName(employee)}`}
                    >
                      <ArrowRightLeft className="size-3.5" />
                      Manage status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm text-muted-foreground">
            {data
              ? data.pagination.total === 0
                ? "No matching employees"
                : `Showing ${(data.pagination.page - 1) * data.pagination.pageSize + 1}–${Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)} of ${data.pagination.total} matching employees`
              : "Employee directory"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!data || page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              Previous
            </button>
            <span className="min-w-20 text-center text-sm text-muted-foreground">
              Page {data?.pagination.page ?? page} of {Math.max(1, data?.pagination.totalPages ?? 1)}
            </span>
            <button
              type="button"
              disabled={!data || page >= data.pagination.totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              Next
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </section>

      {notice ? (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">{notice}</p>
          <button type="button" onClick={() => setNotice("")} className="self-start text-xs font-medium text-muted-foreground hover:text-foreground sm:self-auto">
            Dismiss
          </button>
        </div>
      ) : null}

      <p className="text-xs leading-5 text-muted-foreground">
        Employee records are scoped to the selected school. Login access and school roles remain managed separately by authorized administrators.
      </p>

      <EmployeeStatusDialog
        schoolId={schoolId}
        employee={statusEmployee}
        onClose={() => setStatusEmployee(null)}
        onUpdated={(name, newStatus, message) => {
          setStatusEmployee(null);
          setNotice(message || `${name} status updated to ${statusLabels[newStatus]}.`);
          setReloadToken((current) => current + 1);
        }}
      />

      <EmployeeCreateDialog
        open={createOpen}
        schoolId={schoolId}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) => {
          setCreateOpen(false);
          setSearch("");
          setStatus("");
          setDepartment("");
          setPage(1);
          setNotice(`${name} was added to the employee directory.`);
          setReloadToken((current) => current + 1);
        }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: number | string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
