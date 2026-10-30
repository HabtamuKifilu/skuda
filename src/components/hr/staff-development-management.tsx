"use client";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock3,
  GraduationCap,
  LoaderCircle,
  Plus,
  RefreshCw,
  Target,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

type Goal = {
  id: string;
  title: string;
  description: string | null;
  successCriteria: string | null;
  dueDate: string | null;
  progress: number;
  notes: string | null;
  completedAt: string | null;
  trainingRecordId: string | null;
};

type TrainingRecord = {
  id: string;
  staffProfileId: string;
  title: string;
  provider: string | null;
  status: string;
};

type Plan = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  targetDate: string | null;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  staffProfile: Employee;
  goals: Goal[];
  createdBy?: { id: string; name: string | null; email: string } | null;
};

type Stats = {
  total: number;
  draft: number;
  active: number;
  completed: number;
  cancelled: number;
  overdue: number;
  totalGoals: number;
  completedGoals: number;
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
const buttonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

const filters = ["ALL", "DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
type Filter = (typeof filters)[number];

function employeeName(employee: Employee) {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ");
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function statusLabel(status: Plan["status"]) {
  return {
    DRAFT: "Draft",
    ACTIVE: "Active",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  }[status];
}

function statusClass(status: Plan["status"]) {
  if (status === "ACTIVE") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "CANCELLED") return "border-zinc-200 bg-zinc-100 text-zinc-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function isOverdue(plan: Plan) {
  if (plan.status !== "ACTIVE" || !plan.targetDate) return false;
  const target = new Date(plan.targetDate);
  const today = new Date();
  target.setUTCHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return target < today;
}

export function StaffDevelopmentManagement({ schoolId }: { schoolId: string }) {
  const baseUrl = `/api/schools/${encodeURIComponent(schoolId)}/development`;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0, draft: 0, active: 0, completed: 0, cancelled: 0,
    overdue: 0, totalGoals: 0, completedGoals: 0,
  });
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<
    "ACTIVE" | "COMPLETED" | "CANCELLED" | null
  >(null);

  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [goalDueDate, setGoalDueDate] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [goalTrainingRecordId, setGoalTrainingRecordId] = useState("");
  const [progressDrafts, setProgressDrafts] = useState<Record<string, string>>({});
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalEditDraft, setGoalEditDraft] = useState({
    title: "",
    description: "",
    successCriteria: "",
    dueDate: "",
    notes: "",
    trainingRecordId: "",
  });

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(baseUrl, { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to load staff development plans.");

      const nextPlans = result.plans as Plan[];
      setPlans(nextPlans);
      setEmployees(result.employees as Employee[]);
      setStats(result.stats as Stats);
      setSelectedId((current) =>
        nextPlans.some((plan) => plan.id === current) ? current : nextPlans[0]?.id ?? "",
      );
      setEmployeeId((current) =>
        (result.employees as Employee[]).some((employee) => employee.id === current)
          ? current
          : (result.employees as Employee[])[0]?.id ?? "",
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to load staff development plans.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialData() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(baseUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || "Unable to load staff development plans.");
        }

        const nextPlans = result.plans as Plan[];
        const nextEmployees = result.employees as Employee[];

        if (controller.signal.aborted) return;

        setPlans(nextPlans);
        setEmployees(nextEmployees);
        setStats(result.stats as Stats);
        setSelectedId((current) =>
          nextPlans.some((plan) => plan.id === current) ? current : nextPlans[0]?.id ?? "",
        );
        setEmployeeId((current) =>
          nextEmployees.some((employee) => employee.id === current)
            ? current
            : nextEmployees[0]?.id ?? "",
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unable to load staff development plans.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadInitialData();
    return () => controller.abort();
  }, [baseUrl]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTrainingRecords() {
      try {
        const response = await fetch(
          `/api/schools/${encodeURIComponent(schoolId)}/training`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || "Unable to load training records.");
        }
        if (!controller.signal.aborted) {
          setTrainingRecords(result.records as TrainingRecord[]);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unable to load training records.");
        }
      }
    }

    void loadTrainingRecords();
    return () => controller.abort();
  }, [schoolId]);

  const selected = useMemo(
    () => plans.find((plan) => plan.id === selectedId) ?? null,
    [plans, selectedId],
  );

  const employeeTrainingRecords = useMemo(
    () => trainingRecords.filter((record) => record.staffProfileId === selected?.staffProfile.id),
    [trainingRecords, selected?.staffProfile.id],
  );

  const visiblePlans = useMemo(
    () => plans.filter((plan) => filter === "ALL" || plan.status === filter),
    [plans, filter],
  );

  async function send(url: string, method: "POST" | "PATCH", payload?: Record<string, unknown>) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error || "The request could not be completed.");
    return result;
  }

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await send(baseUrl, "POST", {
        staffProfileId: employeeId,
        title,
        description,
        startDate,
        targetDate: targetDate || null,
        notes,
      });
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setTargetDate("");
      setNotes("");
      setNotice("Development plan created.");
      await load();
      if (result.plan?.id) setSelectedId(result.plan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the plan.");
    } finally {
      setSaving(false);
    }
  }

  async function createGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await send(`${baseUrl}/${encodeURIComponent(selected.id)}/goals`, "POST", {
        title: goalTitle,
        description: goalDescription,
        successCriteria,
        dueDate: goalDueDate || null,
        notes: goalNotes,
        trainingRecordId: goalTrainingRecordId || null,
      });
      setShowGoalForm(false);
      setGoalTitle("");
      setGoalDescription("");
      setSuccessCriteria("");
      setGoalDueDate("");
      setGoalNotes("");
      setGoalTrainingRecordId("");
      setNotice("Development goal added.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add the goal.");
    } finally {
      setSaving(false);
    }
  }

  function startGoalEdit(goal: Goal) {
    setEditingGoalId(goal.id);
    setGoalEditDraft({
      title: goal.title,
      description: goal.description ?? "",
      successCriteria: goal.successCriteria ?? "",
      dueDate: goal.dueDate?.slice(0, 10) ?? "",
      notes: goal.notes ?? "",
      trainingRecordId: goal.trainingRecordId ?? "",
    });
    setError("");
    setNotice("");
  }

  async function saveGoalEdit(event: React.FormEvent<HTMLFormElement>, goal: Goal) {
    event.preventDefault();
    if (!selected || !goalEditDraft.title.trim()) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      await send(`${baseUrl}/goals/${encodeURIComponent(goal.id)}`, "PATCH", {
        title: goalEditDraft.title.trim(),
        description: goalEditDraft.description,
        successCriteria: goalEditDraft.successCriteria,
        dueDate: goalEditDraft.dueDate || null,
        notes: goalEditDraft.notes,
        trainingRecordId: goalEditDraft.trainingRecordId || null,
      });
      setEditingGoalId(null);
      setNotice("Development goal details updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update the goal.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: "ACTIVE" | "COMPLETED" | "CANCELLED") {
    if (!selected) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      await send(`${baseUrl}/${encodeURIComponent(selected.id)}`, "PATCH", { status });
      setNotice(`Plan ${statusLabel(status).toLowerCase()}.`);
      setConfirmStatus(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update the plan.");
    } finally {
      setSaving(false);
    }
  }

  async function changeProgress(goal: Goal, progress: number) {
    if (!selected) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await send(`${baseUrl}/goals/${encodeURIComponent(goal.id)}`, "PATCH", { progress });
      setNotice("Goal progress updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update goal progress.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <GraduationCap className="size-4" />
            People &amp; HR / Growth
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff development</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Build employee growth plans, define measurable goals, and track progress against target dates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading || saving}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button type="button" className={buttonClass} onClick={() => setShowCreate((value) => !value)} disabled={employees.length === 0}>
            <Plus className="size-4" />
            New plan
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total plans", value: stats.total, icon: Users },
          { label: "Active plans", value: stats.active, icon: CircleDashed },
          { label: "Overdue plans", value: stats.overdue, icon: Clock3 },
          { label: "Goals completed", value: `${stats.completedGoals} / ${stats.totalGoals}`, icon: Target },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>{item.label}</span>
                <Icon className="size-4" />
              </div>
              <div className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</div>
            </div>
          );
        })}
      </section>

      {showCreate && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Create development plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose an active employee and set the plan timeframe.</p>
          </div>
          <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={createPlan}>
            <label className="space-y-1.5 md:col-span-2 xl:col-span-1">
              <span className="font-medium">Employee *</span>
              <select className={inputClass} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employeeName(employee)} · {employee.employeeNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 md:col-span-2">
              <span className="font-medium">Plan title *</span>
              <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="e.g. Classroom leadership development" />
            </label>
            <label className="space-y-1.5 xl:col-span-3">
              <span className="font-medium">Description</span>
              <textarea className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} placeholder="Purpose and expected growth outcomes" />
            </label>
            <label className="space-y-1.5">
              <span className="font-medium">Start date *</span>
              <input className={inputClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
            </label>
            <label className="space-y-1.5">
              <span className="font-medium">Target date</span>
              <input className={inputClass} type="date" min={startDate} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </label>
            <label className="space-y-1.5 xl:col-span-3">
              <span className="font-medium">Internal notes</span>
              <textarea className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={4000} />
            </label>
            <div className="flex flex-wrap gap-2 xl:col-span-3">
              <button className={buttonClass} type="submit" disabled={saving || !employeeId}>
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                Create plan
              </button>
              <button className={secondaryButtonClass} type="button" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.5fr)]">
        <div className="min-w-0 rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Development plans</h2>
              <span className="text-xs text-muted-foreground">{visiblePlans.length} records</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {filters.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    filter === item ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {item === "ALL" ? "All" : statusLabel(item)}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border">
            {loading && plans.length === 0 ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Loading plans…
              </div>
            ) : visiblePlans.length === 0 ? (
              <div className="p-8 text-center">
                <GraduationCap className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 font-medium">No plans found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filter === "ALL" ? "Create a plan to start tracking employee development." : "Try another status filter."}
                </p>
              </div>
            ) : visiblePlans.map((plan) => {
              const completeGoals = plan.goals.filter((goal) => goal.progress === 100).length;
              const percent = plan.goals.length ? Math.round(plan.goals.reduce((sum, goal) => sum + goal.progress, 0) / plan.goals.length) : 0;
              return (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => { setSelectedId(plan.id); setShowGoalForm(false); }}
                  className={`block w-full p-4 text-left transition hover:bg-muted/50 ${selectedId === plan.id ? "bg-primary/[0.04] ring-1 ring-inset ring-primary/30" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{plan.title}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{employeeName(plan.staffProfile)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{plan.staffProfile.employeeNumber}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${statusClass(plan.status)}`}>
                      {statusLabel(plan.status)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Target {dateLabel(plan.targetDate)}</span>
                    {isOverdue(plan) && <span className="font-medium text-red-600">Overdue</span>}
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>{completeGoals}/{plan.goals.length} goals complete</span>
                    <span>{percent}% average</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <Target className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">Select a development plan</p>
              <p className="mt-1 text-sm text-muted-foreground">Plan details and goals will appear here.</p>
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(selected.status)}`}>{statusLabel(selected.status)}</span>
                      {isOverdue(selected) && <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">Overdue</span>}
                    </div>
                    <h2 className="mt-3 text-xl font-semibold">{selected.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{employeeName(selected.staffProfile)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[selected.staffProfile.jobTitle, selected.staffProfile.department, selected.staffProfile.employeeNumber].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {selected.status === "DRAFT" && (
                      <button type="button" className={buttonClass} disabled={saving} onClick={() => setConfirmStatus("ACTIVE")}>
                        Activate
                      </button>
                    )}
                    {selected.status === "ACTIVE" && (
                      <button type="button" className={buttonClass} disabled={saving} onClick={() => setConfirmStatus("COMPLETED")}>
                        <CheckCircle2 className="size-4" /> Complete
                      </button>
                    )}
                    {(selected.status === "DRAFT" || selected.status === "ACTIVE") && (
                      <button type="button" className={secondaryButtonClass} disabled={saving} onClick={() => setConfirmStatus("CANCELLED")}>
                        Cancel plan
                      </button>
                    )}
                  </div>
                </div>

                {selected.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selected.description}</p>}

                <div className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Start date</p>
                    <p className="mt-1 font-medium">{dateLabel(selected.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Target date</p>
                    <p className="mt-1 font-medium">{dateLabel(selected.targetDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Goals</p>
                    <p className="mt-1 font-medium">{selected.goals.filter((goal) => goal.progress === 100).length} of {selected.goals.length} complete</p>
                  </div>
                </div>
                {selected.notes && (
                  <div className="mt-4 rounded-lg border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Internal notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{selected.notes}</p>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                  <div>
                    <h3 className="font-semibold">Development goals</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Track measurable outcomes and update each goal&apos;s progress.</p>
                  </div>
                  {(selected.status === "DRAFT" || selected.status === "ACTIVE") && (
                    <button type="button" className={secondaryButtonClass} onClick={() => setShowGoalForm((value) => !value)}>
                      <Plus className="size-4" /> Add goal
                    </button>
                  )}
                </div>

                {showGoalForm && (
                  <form className="grid grid-cols-1 gap-3 border-b border-border bg-muted/20 p-4 md:grid-cols-2" onSubmit={createGoal}>
                    <label className="space-y-1.5 md:col-span-2">
                      <span className="font-medium">Goal title *</span>
                      <input className={inputClass} value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} maxLength={160} required placeholder="e.g. Complete classroom observation training" />
                    </label>
                    <label className="space-y-1.5 md:col-span-2">
                      <span className="font-medium">Description</span>
                      <textarea className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={goalDescription} onChange={(event) => setGoalDescription(event.target.value)} maxLength={4000} />
                    </label>
                    <label className="space-y-1.5 md:col-span-2">
                      <span className="font-medium">Success criteria</span>
                      <textarea className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} maxLength={2000} placeholder="How will successful completion be measured?" />
                    </label>
                    <label className="space-y-1.5">
                      <span className="font-medium">Due date</span>
                      <input className={inputClass} type="date" min={selected.startDate.slice(0, 10)} value={goalDueDate} onChange={(event) => setGoalDueDate(event.target.value)} />
                    </label>
                    <label className="space-y-1.5">
                      <span className="font-medium">Notes</span>
                      <input className={inputClass} value={goalNotes} onChange={(event) => setGoalNotes(event.target.value)} maxLength={4000} />
                    </label>
                    <label className="space-y-1.5 md:col-span-2">
                      <span className="font-medium">Linked training record</span>
                      <select
                        className={inputClass}
                        value={goalTrainingRecordId}
                        onChange={(event) => setGoalTrainingRecordId(event.target.value)}
                        disabled={saving}
                      >
                        <option value="">No linked training record</option>
                        {employeeTrainingRecords.map((record) => (
                          <option key={record.id} value={record.id}>
                            {record.title}{record.provider ? ` — ${record.provider}` : ""} · {record.status.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                      {employeeTrainingRecords.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No training records are available for this employee yet.
                        </p>
                      )}
                    </label>
                    <div className="flex gap-2 md:col-span-2">
                      <button className={buttonClass} type="submit" disabled={saving}>
                        {saving && <LoaderCircle className="size-4 animate-spin" />} Save goal
                      </button>
                      <button className={secondaryButtonClass} type="button" onClick={() => setShowGoalForm(false)} disabled={saving}>Cancel</button>
                    </div>
                  </form>
                )}

                {selected.goals.length === 0 ? (
                  <div className="p-8 text-center">
                    <Target className="mx-auto size-7 text-muted-foreground" />
                    <p className="mt-2 font-medium">No goals yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Add at least one measurable goal before completing the plan.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {selected.goals.map((goal) => (
                      <div key={goal.id} className="space-y-3 p-4">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{goal.title}</p>
                              {(selected.status === "DRAFT" || selected.status === "ACTIVE") && (
                                <button
                                  type="button"
                                  className={secondaryButtonClass}
                                  disabled={saving}
                                  onClick={() => {
                                    if (editingGoalId === goal.id) {
                                      setEditingGoalId(null);
                                    } else {
                                      startGoalEdit(goal);
                                    }
                                  }}
                                >
                                  {editingGoalId === goal.id ? "Close editor" : "Edit details"}
                                </button>
                              )}
                            </div>
                            {goal.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{goal.description}</p>}
                            {goal.successCriteria && (
                              <div className="mt-2 rounded-md bg-muted/40 p-2.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Success criteria</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm">{goal.successCriteria}</p>
                              </div>
                            )}
                            <p className="mt-2 text-xs text-muted-foreground">Due {dateLabel(goal.dueDate)}</p>
                          </div>
                          <span className={`shrink-0 self-start rounded-full border px-2 py-1 text-xs font-medium ${goal.progress === 100 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-muted text-muted-foreground"}`}>
                            {goal.progress === 100 ? "Complete" : `${goal.progress}%`}
                          </span>
                        </div>
                        {editingGoalId === goal.id && (
                          <form
                            className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-4 md:grid-cols-2"
                            onSubmit={(event) => void saveGoalEdit(event, goal)}
                          >
                            <label className="space-y-1.5 md:col-span-2">
                              <span className="text-sm font-medium">Goal title *</span>
                              <input
                                className={inputClass}
                                value={goalEditDraft.title}
                                onChange={(event) => setGoalEditDraft((current) => ({ ...current, title: event.target.value }))}
                                maxLength={160}
                                required
                                disabled={saving}
                              />
                            </label>
                            <label className="space-y-1.5 md:col-span-2">
                              <span className="text-sm font-medium">Description</span>
                              <textarea
                                className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                                value={goalEditDraft.description}
                                onChange={(event) => setGoalEditDraft((current) => ({ ...current, description: event.target.value }))}
                                maxLength={4000}
                                disabled={saving}
                              />
                            </label>
                            <label className="space-y-1.5 md:col-span-2">
                              <span className="text-sm font-medium">Success criteria</span>
                              <textarea
                                className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                                value={goalEditDraft.successCriteria}
                                onChange={(event) => setGoalEditDraft((current) => ({ ...current, successCriteria: event.target.value }))}
                                maxLength={2000}
                                disabled={saving}
                              />
                            </label>
                            <label className="space-y-1.5">
                              <span className="text-sm font-medium">Due date</span>
                              <input
                                className={inputClass}
                                type="date"
                                min={selected.startDate.slice(0, 10)}
                                value={goalEditDraft.dueDate}
                                onChange={(event) => setGoalEditDraft((current) => ({ ...current, dueDate: event.target.value }))}
                                disabled={saving}
                              />
                            </label>
                            <label className="space-y-1.5">
                              <span className="text-sm font-medium">Notes</span>
                              <textarea
                                className="min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                                value={goalEditDraft.notes}
                                onChange={(event) => setGoalEditDraft((current) => ({ ...current, notes: event.target.value }))}
                                maxLength={4000}
                                disabled={saving}
                              />
                            </label>
                            <label className="space-y-1.5 md:col-span-2">
                              <span className="text-sm font-medium">Linked training record</span>
                              <select
                                className={inputClass}
                                value={goalEditDraft.trainingRecordId}
                                onChange={(event) => setGoalEditDraft((current) => ({ ...current, trainingRecordId: event.target.value }))}
                                disabled={saving}
                              >
                                <option value="">No linked training record</option>
                                {employeeTrainingRecords.map((record) => (
                                  <option key={record.id} value={record.id}>
                                    {record.title}{record.provider ? ` — ${record.provider}` : ""} · {record.status.replaceAll("_", " ")}
                                  </option>
                                ))}
                              </select>
                              {employeeTrainingRecords.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  No training records are available for this employee yet.
                                </p>
                              )}
                            </label>
                            <div className="flex gap-2 md:col-span-2">
                              <button
                                className={buttonClass}
                                type="submit"
                                disabled={saving || !goalEditDraft.title.trim()}
                              >
                                {saving && <LoaderCircle className="size-4 animate-spin" />}
                                Save changes
                              </button>
                              <button
                                className={secondaryButtonClass}
                                type="button"
                                disabled={saving}
                                onClick={() => setEditingGoalId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${goal.progress}%` }} />
                          </div>
                          {(selected.status === "DRAFT" || selected.status === "ACTIVE") && (
                            <div className="w-full space-y-2 sm:max-w-sm">
                              <div className="flex items-center justify-between gap-3">
                                <label
                                  htmlFor={`goal-progress-${goal.id}`}
                                  className="text-xs font-medium text-muted-foreground"
                                >
                                  Goal progress
                                </label>
                                <label className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={1}
                                    inputMode="numeric"
                                    aria-label={`Exact progress percentage for ${goal.title}`}
                                    className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-right text-sm font-semibold tabular-nums text-foreground"
                                    value={progressDrafts[goal.id] ?? String(goal.progress)}
                                    disabled={saving}
                                    onChange={(event) => {
                                      const raw = event.target.value;
                                      if (/^\d{0,3}$/.test(raw)) {
                                        setProgressDrafts((current) => ({ ...current, [goal.id]: raw }));
                                      }
                                    }}
                                    onBlur={() => {
                                      const raw = progressDrafts[goal.id];
                                      if (raw === undefined || raw === "") return;
                                      const value = Number(raw);
                                      if (!Number.isInteger(value) || value < 0 || value > 100) {
                                        setProgressDrafts((current) => {
                                          const next = { ...current };
                                          delete next[goal.id];
                                          return next;
                                        });
                                      }
                                    }}
                                  />
                                  <span className="text-sm text-muted-foreground">%</span>
                                </label>
                                <button
                                  type="button"
                                  className={secondaryButtonClass}
                                  disabled={
                                    saving ||
                                    progressDrafts[goal.id] === undefined ||
                                    progressDrafts[goal.id] === "" ||
                                    !Number.isInteger(Number(progressDrafts[goal.id])) ||
                                    Number(progressDrafts[goal.id]) < 0 ||
                                    Number(progressDrafts[goal.id]) > 100 ||
                                    Number(progressDrafts[goal.id]) === goal.progress
                                  }
                                  onClick={() => {
                                    const raw = progressDrafts[goal.id];
                                    if (raw === undefined || raw === "") return;
                                    const value = Number(raw);
                                    if (!Number.isInteger(value) || value < 0 || value > 100) return;
                                    setProgressDrafts((current) => {
                                      const next = { ...current };
                                      delete next[goal.id];
                                      return next;
                                    });
                                    void changeProgress(goal, value);
                                  }}
                                >
                                  Apply
                                </button>
                              </div>
                              <input
                                id={`goal-progress-${goal.id}`}
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={goal.progress}
                                disabled={saving}
                                aria-label={`Adjust progress for ${goal.title}`}
                                aria-valuetext={`${goal.progress}% complete`}
                                onChange={(event) => void changeProgress(goal, Number(event.target.value))}
                                className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
                              />
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>0% · Not started</span>
                                <span>100% · Complete</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {goal.notes && <p className="text-xs text-muted-foreground">Note: {goal.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>

      {employees.length === 0 && !loading && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          No active employees are available. Add or reactivate an employee before creating a development plan.
        </div>
      )}

      {confirmStatus && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-transparent p-4 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setConfirmStatus(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="development-confirm-title"
            aria-describedby="development-confirm-description"
            className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            {(() => {
              const goalCount = selected.goals.length;
              const completedGoals = selected.goals.filter((goal) => goal.progress === 100).length;
              const averageProgress = goalCount
                ? Math.round(selected.goals.reduce((sum, goal) => sum + goal.progress, 0) / goalCount)
                : 0;
              const config = {
                ACTIVE: {
                  eyebrow: "PLAN LIFECYCLE · ACTIVATION",
                  title: "Activate development plan",
                  subtitle: "Move this plan from preparation into active execution.",
                  icon: CheckCircle2,
                  iconClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
                  badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
                  badge: "Ready to activate",
                  primary: "Confirm activation",
                  description: "The plan status will change to Active. HR can then track goal progress and manage development activities against the agreed timeframe.",
                  consequence: "Activation does not automatically complete goals or change the employee’s job assignment.",
                },
                COMPLETED: {
                  eyebrow: "PLAN LIFECYCLE · COMPLETION",
                  title: "Complete development plan",
                  subtitle: "Confirm that the employee’s planned development outcomes have been achieved.",
                  icon: CheckCircle2,
                  iconClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
                  badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
                  badge: "Final status",
                  primary: "Confirm completion",
                  description: "Completion records this plan as finished. The system requires at least one goal, with every goal at 100%, before accepting this change.",
                  consequence: "A completed plan is terminal. Review the goal progress and plan details before proceeding.",
                },
                CANCELLED: {
                  eyebrow: "PLAN LIFECYCLE · CANCELLATION",
                  title: "Cancel development plan",
                  subtitle: "Stop this plan from progressing further.",
                  icon: AlertCircle,
                  iconClass: "border-rose-200 bg-rose-50 text-rose-700",
                  badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
                  badge: "Irreversible action",
                  primary: "Confirm cancellation",
                  description: "This plan will be marked Cancelled. It will remain in the plan history for reference, but it will no longer be an active development commitment.",
                  consequence: "Cancelled plans cannot be reopened, and their goals cannot be edited. Confirm that cancellation is appropriate before continuing.",
                },
              }[confirmStatus];
              const Icon = config.icon;

              return (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
                    <div className="flex min-w-0 items-start gap-3.5">
                      <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl border ${config.iconClass}`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                          {config.eyebrow}
                        </p>
                        <h2 id="development-confirm-title" className="mt-1.5 text-lg font-semibold tracking-tight">
                          {config.title}
                        </h2>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">{config.subtitle}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Close confirmation"
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                      disabled={saving}
                      onClick={() => setConfirmStatus(null)}
                    >
                      <span aria-hidden="true" className="text-xl leading-none">×</span>
                    </button>
                  </div>

                  <div className="space-y-5 px-5 py-5 sm:px-6">
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Selected development plan
                        </p>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${config.badgeClass}`}>
                          {config.badge}
                        </span>
                      </div>
                      <p className="mt-2 break-words text-base font-semibold">{selected.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{employeeName(selected.staffProfile)}</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Current status</p>
                          <p className="mt-1 text-sm font-medium">{statusLabel(selected.status)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Target date</p>
                          <p className="mt-1 text-sm font-medium">{dateLabel(selected.targetDate)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Goal completion</p>
                          <p className="mt-1 text-sm font-medium">{completedGoals}/{goalCount} goals · {averageProgress}% avg.</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold">What this means</h3>
                      <p id="development-confirm-description" className="mt-1.5 text-sm leading-6 text-muted-foreground">
                        {config.description}
                      </p>
                    </div>

                    <div className={`rounded-xl border p-3.5 ${
                      confirmStatus === "CANCELLED"
                        ? "border-rose-200 bg-rose-50/70"
                        : confirmStatus === "COMPLETED"
                          ? "border-emerald-200 bg-emerald-50/70"
                          : "border-indigo-200 bg-indigo-50/70"
                    }`}>
                      <p className={`text-xs font-semibold ${
                        confirmStatus === "CANCELLED"
                          ? "text-rose-800"
                          : confirmStatus === "COMPLETED"
                            ? "text-emerald-800"
                            : "text-indigo-800"
                      }`}>
                        {confirmStatus === "CANCELLED"
                          ? "Important · Permanent status"
                          : confirmStatus === "COMPLETED"
                            ? "Completion requirements"
                            : "Operational impact"}
                      </p>
                      <p className={`mt-1.5 text-sm leading-5 ${
                        confirmStatus === "CANCELLED"
                          ? "text-rose-900"
                          : confirmStatus === "COMPLETED"
                            ? "text-emerald-900"
                            : "text-indigo-900"
                      }`}>
                        {config.consequence}
                      </p>
                      {confirmStatus === "COMPLETED" && (
                        <p className="mt-2 text-xs font-medium text-emerald-900">
                          Current readiness: {goalCount > 0 && completedGoals === goalCount
                            ? "All goals meet the progress requirement."
                            : `${completedGoals} of ${goalCount} goals complete${goalCount === 0 ? "; add at least one goal first" : "; all goals must reach 100%"}.`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p className="text-xs text-muted-foreground">Review the details before confirming.</p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className={`${buttonClass} ${
                          confirmStatus === "CANCELLED"
                            ? "bg-rose-700 hover:bg-rose-800"
                            : confirmStatus === "COMPLETED"
                              ? "bg-emerald-700 hover:bg-emerald-800"
                              : ""
                        }`}
                        disabled={saving}
                        onClick={() => void changeStatus(confirmStatus)}
                      >
                        {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Icon className="size-4" />}
                        {saving ? "Processing…" : config.primary}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </section>
        </div>
      )}
    </div>
  );
}
