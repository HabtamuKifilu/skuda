"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardCheck,
  RefreshCw,
  Save,
  Search,
  Users,
} from "lucide-react";

const statuses = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "LEAVE", label: "Leave" },
  { value: "SICK", label: "Sick" },
  { value: "APPROVED_ABSENCE", label: "Approved absence" },
] as const;

type Status = (typeof statuses)[number]["value"];

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

type Attendance = {
  id: string;
  staffProfileId: string;
  status: Status;
  minutesLate: number | null;
  note: string | null;
};

type Draft = {
  status: Status | "";
  minutesLate: string;
  note: string;
};

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const inputClass =
  "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

export function StaffAttendanceManagement({ schoolId }: { schoolId: string }) {
  const baseUrl = `/api/schools/${encodeURIComponent(schoolId)}/attendance`;
  const [date, setDate] = useState(localToday);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    setNotice("");
    setEmployees([]);
    setDrafts({});

    try {
      const response = await fetch(`${baseUrl}?date=${encodeURIComponent(date)}`, {
        cache: "no-store",
        signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to load attendance.");

      const nextDrafts: Record<string, Draft> = {};
      for (const record of result.records as Attendance[]) {
        nextDrafts[record.staffProfileId] = {
          status: record.status,
          minutesLate: record.minutesLate == null ? "0" : String(record.minutesLate),
          note: record.note ?? "",
        };
      }

      setEmployees(result.employees as Employee[]);
      setDrafts(nextDrafts);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to load attendance.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [baseUrl, date]);

  useEffect(() => {
    const controller = new AbortController();

    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        return load(controller.signal);
      }
    });

    return () => controller.abort();
  }, [load]);

  const visibleEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const name = [employee.firstName, employee.middleName, employee.lastName]
        .filter(Boolean).join(" ");
      const matchesSearch = !query || [
        name,
        employee.employeeNumber,
        employee.jobTitle ?? "",
        employee.department ?? "",
      ].some((value) => value.toLowerCase().includes(query));

      const status = drafts[employee.id]?.status ?? "";
      const matchesFilter = filter === "ALL"
        ? true
        : filter === "UNMARKED"
          ? !status
          : status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [employees, drafts, search, filter]);

  const stats = useMemo(() => {
    const totals: Record<string, number> = {
      total: employees.length,
      marked: 0,
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      LEAVE: 0,
      SICK: 0,
      APPROVED_ABSENCE: 0,
    };

    for (const employee of employees) {
      const status = drafts[employee.id]?.status;
      if (status) {
        totals.marked++;
        totals[status] = (totals[status] ?? 0) + 1;
      }
    }

    return totals;
  }, [employees, drafts]);

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? {
          status: "",
          minutesLate: "0",
          note: "",
        }),
        ...patch,
      },
    }));
  }

  function markAllPresent() {
    setDrafts((current) => {
      const next = { ...current };
      for (const employee of employees) {
        next[employee.id] = {
          status: "PRESENT",
          minutesLate: "0",
          note: next[employee.id]?.note ?? "",
        };
      }
      return next;
    });
  }

  async function save() {
    const records = employees
      .filter((employee) => drafts[employee.id]?.status)
      .map((employee) => {
        const draft = drafts[employee.id];
        return {
          staffProfileId: employee.id,
          status: draft.status,
          minutesLate: draft.status === "LATE" ? Number(draft.minutesLate || 0) : null,
          note: draft.note,
        };
      });

    if (!records.length) {
      setError("Mark at least one employee before saving.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(baseUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to save attendance.");
      setNotice(`Attendance saved for ${result.saved} employee${result.saved === 1 ? "" : "s"}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-5 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ClipboardCheck className="size-4" />
            People &amp; HR / Time &amp; Development
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Staff attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record daily attendance, review absences, and track late arrivals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={markAllPresent}
            disabled={loading || saving || employees.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3 font-medium hover:bg-muted disabled:opacity-50"
          >
            <CheckCheck className="size-4" /> Mark all present
          </button>
          <button
            type="button"
            onClick={save}
            disabled={loading || saving || employees.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Saving…" : "Save attendance"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm">
          <Check className="mr-2 inline size-4" />{notice}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Employees", value: stats.total, icon: Users },
          { label: "Marked", value: stats.marked, icon: ClipboardCheck },
          { label: "Present", value: stats.PRESENT, icon: Check },
          { label: "Absent", value: stats.ABSENT, icon: Users },
          { label: "Late", value: stats.LATE, icon: CalendarDays },
          { label: "Not marked", value: stats.total - stats.marked, icon: RefreshCw },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span>{item.label}</span><Icon className="size-4" />
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1.5 text-xs font-medium sm:w-52">
          Attendance date
          <input
            type="date"
            value={date}
            disabled={loading || saving}
            onChange={(event) => setDate(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="relative flex-1">
          <span className="mb-1.5 block text-xs font-medium">Search employees</span>
          <Search className="absolute left-3 top-[37px] size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, employee number, job title…"
            className={`${inputClass} w-full pl-9`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium sm:w-52">
          Show
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className={inputClass}>
            <option value="ALL">All employees</option>
            <option value="UNMARKED">Not marked</option>
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || saving}
          aria-label="Refresh attendance"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Daily register</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {visibleEmployees.length} of {employees.length} employees · Unmarked employees are not automatically absent.
            </p>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{date}</span>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading attendance…</div>
        ) : employees.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No eligible employees found</p>
            <p className="mt-1 text-sm text-muted-foreground">Active and on-leave employees appear here.</p>
          </div>
        ) : visibleEmployees.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">No employees match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Job / Department</th>
                  <th className="px-4 py-3 font-medium">Attendance status</th>
                  <th className="px-4 py-3 font-medium">Minutes late</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleEmployees.map((employee) => {
                  const draft = drafts[employee.id] ?? { status: "", minutesLate: "0", note: "" };
                  return (
                    <tr key={employee.id} className="align-top hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {[employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ")}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{employee.employeeNumber}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{employee.jobTitle || "—"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{employee.department || "No department"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Attendance status for ${employee.firstName} ${employee.lastName}`}
                          value={draft.status}
                          onChange={(event) => update(employee.id, { status: event.target.value as Draft["status"] })}
                          className={`${inputClass} w-48`}
                        >
                          <option value="">Not marked</option>
                          {statuses.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          aria-label={`Minutes late for ${employee.firstName} ${employee.lastName}`}
                          type="number"
                          min="0"
                          max="1440"
                          disabled={draft.status !== "LATE"}
                          value={draft.minutesLate}
                          onChange={(event) => update(employee.id, { minutesLate: event.target.value })}
                          className={`${inputClass} w-28`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          aria-label={`Attendance note for ${employee.firstName} ${employee.lastName}`}
                          value={draft.note}
                          maxLength={1000}
                          onChange={(event) => update(employee.id, { note: event.target.value })}
                          placeholder="Optional note"
                          className={`${inputClass} w-48`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span>{stats.LEAVE} on leave · {stats.SICK} sick · {stats.APPROVED_ABSENCE} approved absence</span>
          <span>{stats.total - stats.marked} not marked</span>
        </div>
      </div>
    </div>
  );
}
