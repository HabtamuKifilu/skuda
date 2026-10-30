"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import {
  ArrowDownRight, ArrowLeftRight, ArrowRight,
  Building2, CalendarDays, CheckCircle2, ChevronDown, CircleAlert,
  Clock3, FileText, Filter, GitCompareArrows, History, RefreshCw,
  Search, ShieldCheck, Sparkles, Users, UserRound, X,
} from "lucide-react";

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
  status: string;
};

type Transfer = {
  id: string;
  staffProfileId: string;
  effectiveDate: string;
  previousJobTitle: string | null;
  newJobTitle: string | null;
  previousDepartment: string | null;
  newDepartment: string | null;
  description: string | null;
  createdAt: string;
  staffProfile: {
    employeeNumber: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    status: string;
  };
};

type Metrics = {
  totalTransfers: number;
  effectiveThisMonth: number;
  departmentsInRecentTransfers: number;
};

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60";
const buttonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3.5 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
const panelClass = "rounded-2xl border border-border bg-card shadow-sm";

function fullName(person: {
  firstName: string;
  middleName: string | null;
  lastName: string;
}) {
  return [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(" ");
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}

function sameMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getUTCFullYear() === now.getFullYear() &&
    date.getUTCMonth() === now.getMonth();
}

function initials(person: { firstName: string; lastName: string }) {
  return `${person.firstName.trim().charAt(0)}${person.lastName.trim().charAt(0)}`.toUpperCase();
}

export function StaffTransfersManagement({ schoolId }: { schoolId: string }) {
  const base = `/api/schools/${encodeURIComponent(schoolId)}/transfers`;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalTransfers: 0,
    effectiveThisMonth: 0,
    departmentsInRecentTransfers: 0,
  });
  const [staffProfileId, setStaffProfileId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyPeriod, setHistoryPeriod] = useState("all");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(base, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load transfers.");
      }
      setEmployees(payload.employees ?? []);
      setTransfers(payload.transfers ?? []);
      setMetrics(payload.metrics ?? {
        totalTransfers: 0,
        effectiveThisMonth: 0,
        departmentsInRecentTransfers: 0,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load transfers.");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    const schedule = Promise.resolve().then(() => load());
    return () => {
      void schedule;
    };
  }, [load]);

  const selected = employees.find((employee) => employee.id === staffProfileId);

  const analytics = useMemo(() => {
    const now = new Date();
    const monthKeys = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
      return {
        key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
        label: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date),
      };
    });

    const monthlyCounts = new Map(monthKeys.map((month) => [month.key, 0]));
    for (const transfer of transfers) {
      const date = new Date(transfer.effectiveDate);
      if (Number.isNaN(date.getTime())) continue;
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      if (monthlyCounts.has(key)) monthlyCounts.set(key, (monthlyCounts.get(key) ?? 0) + 1);
    }

    const departmentCounts = new Map<string, number>();
    for (const transfer of transfers) {
      const department = transfer.newDepartment?.trim() || "Unspecified";
      departmentCounts.set(department, (departmentCounts.get(department) ?? 0) + 1);
    }
    const departments = [...departmentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return {
      monthLabels: monthKeys.map((month) => month.label),
      monthValues: monthKeys.map((month) => monthlyCounts.get(month.key) ?? 0),
      departments: departments.map(([name]) => name),
      departmentValues: departments.map(([, count]) => count),
    };
  }, [transfers]);

  const monthlyChartOption = useMemo<EChartsOption>(() => ({
    animationDuration: 650,
    grid: { top: 24, right: 18, bottom: 12, left: 8, containLabel: true },
    tooltip: { trigger: "axis", backgroundColor: "#111827", borderWidth: 0, textStyle: { color: "#f9fafb" } },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: analytics.monthLabels,
      axisLine: { lineStyle: { color: "#d1d5db" } },
      axisTick: { show: false },
      axisLabel: { color: "#6b7280" },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#e5e7eb", type: "dashed" } },
      axisLabel: { color: "#6b7280" },
    },
    series: [{
      name: "Transfers",
      type: "line",
      smooth: 0.35,
      data: analytics.monthValues,
      symbol: "circle",
      symbolSize: 7,
      lineStyle: { width: 3, color: "#6366f1" },
      itemStyle: { color: "#6366f1", borderColor: "#fff", borderWidth: 2 },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [
        { offset: 0, color: "rgba(99,102,241,0.25)" },
        { offset: 1, color: "rgba(99,102,241,0.015)" },
      ] } },
    }],
  }), [analytics]);

  const departmentChartOption = useMemo<EChartsOption>(() => ({
    animationDuration: 650,
    grid: { top: 8, right: 24, bottom: 8, left: 8, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#111827", borderWidth: 0, textStyle: { color: "#f9fafb" } },
    xAxis: {
      type: "value",
      minInterval: 1,
      splitLine: { lineStyle: { color: "#e5e7eb", type: "dashed" } },
      axisLabel: { color: "#6b7280" },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: analytics.departments,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: "#6b7280", width: 120, overflow: "truncate" },
    },
    series: [{
      name: "Transfers",
      type: "bar",
      data: analytics.departmentValues,
      barMaxWidth: 22,
      showBackground: true,
      backgroundStyle: { color: "rgba(148,163,184,0.10)", borderRadius: 6 },
      itemStyle: { color: "#818cf8", borderRadius: [0, 6, 6, 0] },
      label: { show: true, position: "right", color: "#6b7280", fontWeight: 600 },
    }],
  }), [analytics]);

  const employeeOptions = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) =>
      [
        employee.employeeNumber,
        fullName(employee),
        employee.jobTitle ?? "",
        employee.department ?? "",
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [employees, employeeSearch]);

  const visibleTransfers = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return transfers.filter((transfer) => {
      const matchesQuery = !query || [
        transfer.staffProfile.employeeNumber,
        fullName(transfer.staffProfile),
        transfer.previousJobTitle ?? "",
        transfer.newJobTitle ?? "",
        transfer.previousDepartment ?? "",
        transfer.newDepartment ?? "",
        transfer.description ?? "",
      ].some((value) => value.toLowerCase().includes(query));

      const matchesPeriod = historyPeriod === "all" ||
        (historyPeriod === "month" && sameMonth(transfer.effectiveDate)) ||
        (historyPeriod === "future" &&
          transfer.effectiveDate.slice(0, 10) > new Date().toISOString().slice(0, 10));

      return matchesQuery && matchesPeriod;
    });
  }, [transfers, historySearch, historyPeriod]);

  const selectEmployee = (id: string) => {
    setStaffProfileId(id);
    const employee = employees.find((item) => item.id === id);
    setNewJobTitle(employee?.jobTitle ?? "");
    setNewDepartment(employee?.department ?? "");
    setError("");
    setNotice("");
  };

  const resetForm = () => {
    setStaffProfileId("");
    setEmployeeSearch("");
    setNewJobTitle("");
    setNewDepartment("");
    setEffectiveDate(new Date().toISOString().slice(0, 10));
    setReason("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffProfileId,
          newJobTitle,
          newDepartment,
          effectiveDate,
          reason,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to record the transfer.");
      }

      setNotice("Transfer recorded successfully. Employment history and audit records were updated.");
      resetForm();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record the transfer.");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setHistorySearch("");
    setHistoryPeriod("all");
  };

  return (
    <div className="w-full space-y-6 p-4 md:p-6 xl:p-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="size-4" />
            <span>People &amp; HR</span>
            <span className="text-border">/</span>
            <span>Employment &amp; Insights</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
              <ArrowLeftRight className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Staff transfers
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Manage internal mobility, preserve assignment history, and keep every change accountable.
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground sm:inline-flex">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            School-scoped records
          </span>
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading || saving}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">{error}</div>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
            <X className="size-4" />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-600/25 bg-emerald-600/5 px-4 py-3.5 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">{notice}</div>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss success message">
            <X className="size-4" />
          </button>
        </div>
      )}

      <section aria-label="Transfer overview" className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          icon={<History className="size-5" />}
          label="Recorded transfers"
          value={loading ? "—" : metrics.totalTransfers.toLocaleString()}
          note="All-time school history"
          accent="indigo"
        />
        <MetricCard
          icon={<CalendarDays className="size-5" />}
          label="Effective this month"
          value={loading ? "—" : metrics.effectiveThisMonth.toLocaleString()}
          note="Grouped by effective date"
          accent="blue"
        />
        <MetricCard
          icon={<Building2 className="size-5" />}
          label="Departments represented"
          value={loading ? "—" : metrics.departmentsInRecentTransfers.toLocaleString()}
          note="Across recent movements"
          accent="violet"
        />
        <MetricCard
          icon={<Users className="size-5" />}
          label="Eligible employees"
          value={loading ? "—" : employees.length.toLocaleString()}
          note="Active and on leave"
          accent="emerald"
        />
      </section>

      <section aria-label="Transfer analytics" className="grid grid-cols-1 gap-4 2xl:grid-cols-5">
        <div className={`${panelClass} overflow-hidden 2xl:col-span-3`}>
          <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Mobility intelligence</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight">Transfer activity</h2>
              <p className="mt-1 text-xs text-muted-foreground">Effective-dated movement over the last six months</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-2 rounded-full bg-indigo-500" />
              Monthly trend
            </span>
          </div>
          {loading ? (
            <div className="h-[260px] animate-pulse bg-muted/20" />
          ) : transfers.length === 0 ? (
            <div className="flex h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><History className="size-5" /></div>
              <p className="mt-3 text-sm font-semibold">No transfer activity yet</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Once transfers are recorded, this chart will show monthly movement.</p>
            </div>
          ) : (
            <div className="px-2 py-3 sm:px-4">
              <ReactECharts option={monthlyChartOption} notMerge lazyUpdate style={{ height: 260, width: "100%" }} opts={{ renderer: "canvas" }} />
            </div>
          )}
        </div>

        <div className={`${panelClass} overflow-hidden 2xl:col-span-2`}>
          <div className="border-b border-border px-5 py-4 md:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Organizational view</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">Destination departments</h2>
            <p className="mt-1 text-xs text-muted-foreground">Most represented destinations in recorded transfers</p>
          </div>
          {loading ? (
            <div className="h-[260px] animate-pulse bg-muted/20" />
          ) : analytics.departments.length === 0 ? (
            <div className="flex h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><Building2 className="size-5" /></div>
              <p className="mt-3 text-sm font-semibold">Department insights will appear here</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Recorded destination departments will populate this breakdown automatically.</p>
            </div>
          ) : (
            <div className="px-2 py-3 sm:px-4">
              <ReactECharts option={departmentChartOption} notMerge lazyUpdate style={{ height: 260, width: "100%" }} opts={{ renderer: "canvas" }} />
            </div>
          )}
        </div>
      </section>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="border-b border-border px-5 py-5 md:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GitCompareArrows className="size-4.5" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">Record a transfer</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Review the employee&apos;s current assignment before recording the destination.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" /> Guided workflow
            </span>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-6 p-5 md:p-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
                Select employee
              </div>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Find a staff member <span className="text-destructive">*</span></span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className={`${inputClass} pl-10`}
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Search name, employee ID, role…"
                    autoComplete="off"
                    aria-label="Search eligible employees"
                  />
                </span>
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Employee <span className="text-destructive">*</span></span>
                <span className="relative block">
                  <select
                    required
                    className={`${inputClass} appearance-none pr-10`}
                    value={staffProfileId}
                    onChange={(event) => selectEmployee(event.target.value)}
                    disabled={loading || employees.length === 0}
                  >
                    <option value="">Select an employee</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.employeeNumber} — {fullName(employee)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </span>
                <span className="block text-xs text-muted-foreground">
                  {employeeOptions.length} matching {employeeOptions.length === 1 ? "employee" : "employees"}
                </span>
              </label>

              {selected ? (
                <div className="rounded-xl border border-border bg-muted/35 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-sm font-semibold text-primary">
                      {initials(selected)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{fullName(selected)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{selected.employeeNumber}</p>
                    </div>
                    <span className="rounded-full border border-emerald-600/20 bg-emerald-600/5 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      {selected.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Current job title</p>
                      <p className="mt-1 break-words text-sm font-medium">{selected.jobTitle || "Not specified"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Current department</p>
                      <p className="mt-1 break-words text-sm font-medium">{selected.department || "Not assigned"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
                  <div>
                    <UserRound className="mx-auto size-5 text-muted-foreground/70" />
                    <p className="mt-2 text-sm font-medium">Employee details appear here</p>
                    <p className="mt-1 text-xs text-muted-foreground">Choose a staff member to compare assignments.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
                Define destination assignment
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">New job title <span className="text-destructive">*</span></span>
                  <input
                    required
                    maxLength={150}
                    className={inputClass}
                    value={newJobTitle}
                    onChange={(event) => setNewJobTitle(event.target.value)}
                    placeholder="e.g. Science Teacher"
                    disabled={!selected || saving}
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Destination department</span>
                  <input
                    maxLength={150}
                    className={inputClass}
                    value={newDepartment}
                    onChange={(event) => setNewDepartment(event.target.value)}
                    placeholder="e.g. Science"
                    disabled={!selected || saving}
                  />
                </label>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assignment comparison</p>
                <div className="grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-start gap-2">
                  <AssignmentSide
                    label="Current"
                    title={selected?.jobTitle || "No title"}
                    department={selected?.department || "No department"}
                    tone="neutral"
                  />
                  <ArrowRight className="mt-8 size-5 text-primary" />
                  <AssignmentSide
                    label="Destination"
                    title={newJobTitle.trim() || "New job title"}
                    department={newDepartment.trim() || "No department"}
                    tone="primary"
                  />
                </div>
                {selected &&
                  (selected.jobTitle ?? "") === newJobTitle.trim() &&
                  (selected.department ?? "") === (newDepartment.trim() || "") && (
                    <p className="mt-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                      <CircleAlert className="size-3.5" />
                      The destination currently matches the employee&apos;s assignment.
                    </p>
                  )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Effective date <span className="text-destructive">*</span></span>
                  <span className="relative block">
                    <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      required
                      type="date"
                      className={`${inputClass} pl-10`}
                      value={effectiveDate}
                      onChange={(event) => setEffectiveDate(event.target.value)}
                      disabled={saving}
                    />
                  </span>
                </label>
                <div className="space-y-1.5 text-sm">
                  <span className="font-medium">Record type</span>
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-muted/35 px-3.5 text-sm">
                    <ArrowLeftRight className="size-4 text-primary" />
                    Internal transfer
                    <span className="ml-auto text-xs text-muted-foreground">Permanent record</span>
                  </div>
                </div>
              </div>

              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Reason and justification <span className="text-destructive">*</span></span>
                <textarea
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Document the operational need, reassignment rationale, or approved internal move…"
                  disabled={saving}
                />
                <span className="block text-right text-xs text-muted-foreground">{reason.length}/1000</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium">History and audit are included</p>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                  Recording updates the employee&apos;s current assignment and preserves the previous values in employment history. Review the employee and destination before submitting.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" className={secondaryButtonClass} onClick={resetForm} disabled={saving}>
                Reset
              </button>
              <button type="submit" className={buttonClass} disabled={saving || loading || !selected || !employees.length}>
                {saving ? <RefreshCw className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}
                {saving ? "Recording transfer…" : "Record transfer"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-col gap-4 border-b border-border px-5 py-5 md:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
                <History className="size-4.5" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">Transfer history</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">{visibleTransfers.length}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Recent transfer records, ordered by effective date.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block sm:min-w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${inputClass} pl-9`}
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search transfer history…"
                aria-label="Search transfer history"
              />
            </label>
            <label className="relative block sm:min-w-44">
              <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <select
                className={`${inputClass} appearance-none pl-9 pr-9`}
                value={historyPeriod}
                onChange={(event) => setHistoryPeriod(event.target.value)}
                aria-label="Filter transfer history by date"
              >
                <option value="all">All dates</option>
                <option value="month">Effective this month</option>
                <option value="future">Future-effective</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </label>
            {(historySearch || historyPeriod !== "all") && (
              <button type="button" className={secondaryButtonClass} onClick={clearFilters}>
                <X className="size-4" /> Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-5 md:p-6" aria-label="Loading transfer history">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-4 py-3">
                <div className="size-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-muted" />
                  <div className="h-3 w-56 max-w-full rounded bg-muted" />
                </div>
                <div className="hidden h-3 w-24 rounded bg-muted sm:block" />
              </div>
            ))}
          </div>
        ) : visibleTransfers.length === 0 ? (
          <div className="px-5 py-14 text-center md:px-6">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/40">
              {transfers.length ? <Search className="size-5 text-muted-foreground" /> : <History className="size-5 text-muted-foreground" />}
            </div>
            <h3 className="mt-4 font-semibold">
              {transfers.length ? "No matching transfers" : "No transfers recorded yet"}
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
              {transfers.length
                ? "Try another search term or clear the filters to see more records."
                : "When you record a staff transfer, the assignment change and its history will appear here."}
            </p>
            {transfers.length > 0 && (
              <button type="button" className={`${secondaryButtonClass} mt-4`} onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/35">
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3.5 font-semibold">Employee</th>
                    <th className="px-4 py-3.5 font-semibold">Previous assignment</th>
                    <th className="px-4 py-3.5 font-semibold">Destination assignment</th>
                    <th className="px-4 py-3.5 font-semibold">Effective date</th>
                    <th className="px-5 py-3.5 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransfers.map((transfer) => (
                    <tr key={transfer.id} className="border-b border-border/70 align-top transition-colors last:border-0 hover:bg-muted/20">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60 text-xs font-semibold">
                            {initials(transfer.staffProfile)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold">{fullName(transfer.staffProfile)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{transfer.staffProfile.employeeNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium">{transfer.previousJobTitle || "No title"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{transfer.previousDepartment || "No department"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-2">
                          <ArrowDownRight className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                          <div>
                            <p className="font-semibold">{transfer.newJobTitle || "No title"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{transfer.newDepartment || "No department"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Clock3 className="size-3.5 text-muted-foreground" />
                          {dateLabel(transfer.effectiveDate)}
                        </div>
                        {transfer.effectiveDate.slice(0, 10) > new Date().toISOString().slice(0, 10) && (
                          <span className="mt-1.5 inline-flex rounded-full border border-blue-600/20 bg-blue-600/5 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                            Future-effective
                          </span>
                        )}
                      </td>
                      <td className="max-w-xs whitespace-normal px-5 py-4">
                        <p className="line-clamp-3 leading-relaxed text-muted-foreground">{transfer.description || "No reason recorded"}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 border-t border-border bg-muted/15 px-5 py-3.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>Showing {visibleTransfers.length} of {metrics.totalTransfers} recorded transfers</span>
              <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" /> History and audit records are retained</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  accent: "indigo" | "blue" | "violet" | "emerald";
}) {
  const accentStyles = {
    indigo: { icon: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", bar: "bg-indigo-500", halo: "from-indigo-500/[0.10]" },
    blue: { icon: "bg-sky-500/10 text-sky-600 dark:text-sky-400", bar: "bg-sky-500", halo: "from-sky-500/[0.10]" },
    violet: { icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400", bar: "bg-violet-500", halo: "from-violet-500/[0.10]" },
    emerald: { icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", halo: "from-emerald-500/[0.10]" },
  }[accent];

  return (
    <div className={`${panelClass} group relative isolate overflow-hidden p-2.5 transition-shadow duration-200 hover:shadow-md`}>
      <div className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${accentStyles.halo} via-transparent to-transparent opacity-80`} />
      <div className="flex items-center justify-between gap-2">
        <div className={`flex size-8 items-center justify-center rounded-lg ring-1 ring-inset ring-black/[0.025] ${accentStyles.icon}`}>
          {icon}
        </div>
        <span className="hidden">HR metric</span>
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-xl font-semibold tracking-tight tabular-nums">{value}</p>
       
      </div>
      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{note}</p>
      <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-muted/70">
        <div className={`h-full w-1/3 rounded-full ${accentStyles.bar} opacity-75 transition-all duration-300 group-hover:w-1/2`} />
      </div>
    </div>
  );
}

function AssignmentSide({
  label,
  title,
  department,
  tone,
}: {
  label: string;
  title: string;
  department: string;
  tone: "neutral" | "primary";
}) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 ${
      tone === "primary"
        ? "border-primary/25 bg-primary/[0.045]"
        : "border-border bg-muted/25"
    }`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${
        tone === "primary" ? "text-primary" : "text-muted-foreground"
      }`}>{label}</p>
      <p className="mt-2 break-words text-sm font-semibold">{title}</p>
      <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{department}</p>
    </div>
  );
}
