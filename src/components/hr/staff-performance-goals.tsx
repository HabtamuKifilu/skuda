"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Flag,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Target,
  X,
} from "lucide-react";

type Employee = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  employeeNumber?: string | null;
  staffNumber?: string | null;
  userId?: string | null;
};

type ProgressUpdate = {
  id: string;
  progress: number;
  currentValue?: number | string | null;
  note?: string | null;
  evidence?: string | null;
  createdAt: string;
  recordedBy?: { id: string; name?: string | null } | null;
};

type Goal = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  targetValue: number | string;
  baselineValue?: number | string | null;
  currentValue?: number | string | null;
  unit?: string | null;
  successCriteria?: string | null;
  priority: string;
  status: string;
  progress: number;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
  staffProfile: {
    id: string;
    employeeNumber?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    userId?: string | null;
  };
  createdBy?: { id: string; name?: string | null; email?: string | null };
  progressUpdates?: ProgressUpdate[];
};

type GoalForm = {
  staffProfileId: string;
  title: string;
  description: string;
  category: string;
  targetValue: string;
  baselineValue: string;
  currentValue: string;
  unit: string;
  successCriteria: string;
  priority: string;
  startDate: string;
  dueDate: string;
};

const emptyForm = (): GoalForm => ({
  staffProfileId: "",
  title: "",
  description: "",
  category: "Teaching & Learning",
  targetValue: "",
  baselineValue: "",
  currentValue: "",
  unit: "",
  successCriteria: "",
  priority: "NORMAL",
  startDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
});

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
const areaClass =
  "min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
const buttonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50";

function personName(person?: Employee | Goal["staffProfile"] | null) {
  if (!person) return "Unknown employee";
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return fullName || ("name" in person ? person.name : null) || "Unnamed employee";
}

function dateLabel(value?: string | null) {
  if (!value) return "No deadline";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function valueLabel(value: number | string | null | undefined, unit?: string | null) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  const number = Number(value);
  return `${Number.isFinite(number) ? number.toLocaleString() : value}${unit ? ` ${unit}` : ""}`;
}

function statusStyle(status: string) {
  if (status === "ACTIVE") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "CANCELLED") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

async function requestError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error || body.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export function StaffPerformanceGoals({
  schoolId,
  employees,
  isManager,
}: {
  schoolId: string;
  employees: Employee[];
  isManager: boolean;
}) {
  const baseUrl = `/api/schools/${encodeURIComponent(schoolId)}/performance/goals`;
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GoalForm>(emptyForm);
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [progress, setProgress] = useState("0");
  const [currentValue, setCurrentValue] = useState("");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(await requestError(response));
      const data = (await response.json()) as { goals?: Goal[] };
      setGoals(data.goals ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load goals.");
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void load();
    });
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId);
  const visibleGoals = goals.filter(
    (goal) => filter === "ALL" || goal.status === filter,
  );
  const activeCount = goals.filter((goal) => goal.status === "ACTIVE").length;
  const completedCount = goals.filter((goal) => goal.status === "COMPLETED").length;
  const overdueCount = goals.filter(
    (goal) =>
      goal.status === "ACTIVE" &&
      goal.dueDate &&
      new Date(goal.dueDate).getTime() < new Date().setHours(0, 0, 0, 0),
  ).length;

  async function createGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        ...form,
        targetValue: Number(form.targetValue),
        baselineValue: form.baselineValue === "" ? null : Number(form.baselineValue),
        currentValue: form.currentValue === "" ? null : Number(form.currentValue),
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
      };
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await requestError(response));
      setShowForm(false);
      setForm(emptyForm());
      setNotice("Performance goal created.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create goal.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(goal: Goal, status: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${baseUrl}/${encodeURIComponent(goal.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await requestError(response));
      setNotice(`Goal status changed to ${status.toLowerCase().replaceAll("_", " ")}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update goal.");
    } finally {
      setSaving(false);
    }
  }

  async function recordProgress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGoal) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload: {
        progress: number;
        note: string | null;
        evidence: string | null;
        currentValue?: number | null;
      } = {
        progress: Number(progress),
        note: note.trim() || null,
        evidence: evidence.trim() || null,
      };
      if (currentValue !== "") payload.currentValue = Number(currentValue);

      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(selectedGoal.id)}/progress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error(await requestError(response));
      setNote("");
      setEvidence("");
      setNotice("Progress update and evidence recorded.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record progress.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Target className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Objectives & accountability
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Performance goals
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Measurable targets, evidence-backed updates, and deadline tracking.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryClass} onClick={() => void load()} disabled={loading || saving}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {isManager && (
            <button type="button" className={buttonClass} onClick={() => setShowForm((value) => !value)} disabled={saving}>
              {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
              {showForm ? "Cancel" : "Create goal"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
          <button type="button" className="ml-auto" onClick={() => setError("")} aria-label="Dismiss error">
            <X className="size-4" />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0" />
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Total goals", value: goals.length, icon: Target },
          { label: "Active", value: activeCount, icon: Activity },
          { label: "Completed", value: completedCount, icon: CheckCircle2 },
          { label: "Overdue", value: overdueCount, icon: Clock3 },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <item.icon className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      {isManager && showForm && (
        <form onSubmit={createGoal} className="space-y-5 rounded-xl border border-border bg-muted/20 p-4 md:p-5">
          <div>
            <h3 className="font-semibold">Create a measurable objective</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Define the staff member, baseline, target, success criteria, and deadline.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1.5 text-sm md:col-span-2 xl:col-span-1">
              <span className="font-medium">Assigned employee *</span>
              <select className={inputClass} value={form.staffProfileId} onChange={(event) => setForm({ ...form, staffProfileId: event.target.value })} required>
                <option value="">Choose employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {personName(employee)}{employee.employeeNumber || employee.staffNumber ? ` · ${employee.employeeNumber || employee.staffNumber}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium">Goal title *</span>
              <input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} required placeholder="e.g. Improve assessment turnaround" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Category *</span>
              <select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required>
                {["Teaching & Learning", "Student Outcomes", "Leadership", "Administration", "Professional Development", "Attendance & Punctuality", "Safeguarding", "Other"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Baseline value</span>
              <input className={inputClass} type="number" min="0" step="0.01" value={form.baselineValue} onChange={(event) => setForm({ ...form, baselineValue: event.target.value })} placeholder="Starting value" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Target value *</span>
              <input className={inputClass} type="number" min="0.01" step="0.01" value={form.targetValue} onChange={(event) => setForm({ ...form, targetValue: event.target.value })} required />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Current value</span>
              <input className={inputClass} type="number" min="0" step="0.01" value={form.currentValue} onChange={(event) => setForm({ ...form, currentValue: event.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Unit</span>
              <input className={inputClass} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} maxLength={50} placeholder="%, score, hours…" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Priority</span>
              <select className={inputClass} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                {["LOW", "NORMAL", "HIGH", "CRITICAL"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Start date</span>
              <input className={inputClass} type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Due date</span>
              <input className={inputClass} type="date" value={form.dueDate} min={form.startDate || undefined} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </label>
            <label className="space-y-1.5 text-sm md:col-span-2 xl:col-span-3">
              <span className="font-medium">Description</span>
              <textarea className={areaClass} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={5000} placeholder="Context, expectations, and resources…" />
            </label>
            <label className="space-y-1.5 text-sm md:col-span-2 xl:col-span-3">
              <span className="font-medium">Success criteria</span>
              <textarea className={areaClass} value={form.successCriteria} onChange={(event) => setForm({ ...form, successCriteria: event.target.value })} maxLength={3000} placeholder="How will successful completion be demonstrated?" />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondaryClass} onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
            <button type="submit" className={buttonClass} disabled={saving || employees.length === 0}>
              {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "Creating…" : "Create goal"}
            </button>
          </div>
          {employees.length === 0 && <p className="text-sm text-muted-foreground">No employees are available for assignment.</p>}
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Goal register</h3>
        <select aria-label="Filter goals by status" className={`${inputClass} max-w-48`} value={filter} onChange={(event) => setFilter(event.target.value)}>
          {["ALL", "DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"].map((item) => <option key={item} value={item}>{item === "ALL" ? "All statuses" : item.replaceAll("_", " ")}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> Loading performance goals…
        </div>
      ) : visibleGoals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
          <Target className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No goals found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === "ALL" ? "Create a goal to start tracking measurable performance objectives." : "No goals match this status filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleGoals.map((goal) => {
            const overdue = goal.status === "ACTIVE" && goal.dueDate && new Date(goal.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);
            return (
              <article key={goal.id} className="rounded-xl border border-border bg-background p-4 md:p-5">
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyle(goal.status)}`}>{goal.status.replaceAll("_", " ")}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Flag className="size-3.5" />{goal.priority}</span>
                      <span className="text-xs text-muted-foreground">{goal.category}</span>
                      {overdue && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>}
                    </div>
                    <h4 className="mt-2 text-base font-semibold">{goal.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">{personName(goal.staffProfile)}{goal.staffProfile.jobTitle ? ` · ${goal.staffProfile.jobTitle}` : ""}{goal.staffProfile.department ? ` · ${goal.staffProfile.department}` : ""}</p>
                    {goal.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{goal.description}</p>}
                    {goal.successCriteria && <p className="mt-2 text-sm"><span className="font-medium">Success criteria:</span> {goal.successCriteria}</p>}
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">Baseline</p>
                        <p className="mt-1 font-semibold">{valueLabel(goal.baselineValue, goal.unit)}</p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">Current value</p>
                        <p className="mt-1 font-semibold">{valueLabel(goal.currentValue, goal.unit)}</p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">Target</p>
                        <p className="mt-1 font-semibold">{valueLabel(goal.targetValue, goal.unit)}</p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-xs text-muted-foreground">Deadline</p>
                        <p className="mt-1 font-semibold">{dateLabel(goal.dueDate)}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Reported progress</span>
                        <span className="font-semibold tabular-nums">{goal.progress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 xl:max-w-64 xl:justify-end">
                    {goal.status !== "COMPLETED" && goal.status !== "CANCELLED" && (
                      <button type="button" className={buttonClass} onClick={() => { setSelectedGoalId(goal.id); setProgress(String(goal.progress)); setCurrentValue(goal.currentValue == null ? "" : String(goal.currentValue)); setNote(""); setEvidence(""); }} disabled={saving}>
                        <Activity className="size-4" /> Update progress
                      </button>
                    )}
                    {isManager && goal.status === "DRAFT" && (
                      <button type="button" className={secondaryClass} onClick={() => void updateStatus(goal, "ACTIVE")} disabled={saving}>Activate</button>
                    )}
                    {isManager && goal.status === "ACTIVE" && (
                      <button type="button" className={secondaryClass} onClick={() => void updateStatus(goal, "COMPLETED")} disabled={saving}>Complete</button>
                    )}
                    {isManager && (goal.status === "DRAFT" || goal.status === "ACTIVE") && (
                      <button type="button" className={secondaryClass} onClick={() => { if (window.confirm(`Cancel the goal "${goal.title}"?`)) void updateStatus(goal, "CANCELLED"); }} disabled={saving}>Cancel goal</button>
                    )}
                  </div>
                </div>

                {selectedGoalId === goal.id && (
                  <form onSubmit={recordProgress} className="mt-5 space-y-4 rounded-xl border border-primary/20 bg-primary/[0.035] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h5 className="font-semibold">Record progress update</h5>
                      <button type="button" className="rounded-lg p-1.5 hover:bg-muted" onClick={() => setSelectedGoalId("")} aria-label="Close progress form"><X className="size-4" /></button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Progress percentage *</span>
                        <input className={inputClass} type="number" min="0" max="100" step="1" required value={progress} onChange={(event) => setProgress(event.target.value)} />
                      </label>
                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Current measured value</span>
                        <input className={inputClass} type="number" min="0" step="0.01" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} placeholder="Leave blank to retain current value" />
                      </label>
                      <label className="space-y-1.5 text-sm sm:col-span-2">
                        <span className="font-medium">Progress notes</span>
                        <textarea className={areaClass} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="What changed since the last update?" />
                      </label>
                      <label className="space-y-1.5 text-sm sm:col-span-2">
                        <span className="font-medium">Evidence</span>
                        <textarea className={areaClass} value={evidence} onChange={(event) => setEvidence(event.target.value)} maxLength={5000} placeholder="Document the evidence, observations, results, or reference details supporting this update." />
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className={buttonClass} disabled={saving || !Number.isInteger(Number(progress)) || Number(progress) < 0 || Number(progress) > 100}>
                        {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                        Save progress
                      </button>
                    </div>
                  </form>
                )}

                <div className="mt-5 border-t border-border pt-4">
                  <h5 className="text-sm font-semibold">Recent progress history</h5>
                  {!goal.progressUpdates?.length ? (
                    <p className="mt-2 text-sm text-muted-foreground">No progress updates recorded yet.</p>
                  ) : (
                    <ol className="mt-3 space-y-3">
                      {goal.progressUpdates.map((update) => (
                        <li key={update.id} className="flex gap-3">
                          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Activity className="size-4 text-muted-foreground" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                              <span className="font-semibold">{update.progress}% progress</span>
                              {update.currentValue != null && <span className="text-muted-foreground">· {valueLabel(update.currentValue, goal.unit)}</span>}
                              <span className="text-xs text-muted-foreground">· {dateLabel(update.createdAt)}</span>
                            </div>
                            {update.note && <p className="mt-1 whitespace-pre-wrap text-sm leading-5">{update.note}</p>}
                            {update.evidence && <p className="mt-1 whitespace-pre-wrap text-sm leading-5"><span className="font-medium">Evidence:</span> {update.evidence}</p>}
                            <p className="mt-1 text-xs text-muted-foreground">Recorded by {update.recordedBy?.name || "School member"}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
