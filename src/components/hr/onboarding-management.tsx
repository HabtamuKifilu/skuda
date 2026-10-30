"use client";

import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OnboardingWorkflows } from "@/components/hr/onboarding-workflows";

type Task = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: "PENDING" | "COMPLETED";
  completedAt: string | null;
};

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
};

type Plan = {
  id: string;
  startDate: string;
  targetCompletionDate: string | null;
  notes: string | null;
  completedAt: string | null;
  staffProfile: Employee & { status: string };
  tasks: Task[];
};

type Stats = {
  total: number;
  completed: number;
  overdue: number;
  inProgress: number;
};

type Readiness = {
  onboardingId: string;
  completedAt: string | null;
  ready: boolean;
  blockers: string[];
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

function dateLabel(value: string | null) {
  if (!value) return "Not set";
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
  return [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");
}

export function OnboardingManagement({ schoolId, schoolRole }: { schoolId: string; schoolRole: string }) {
  const baseUrl = `/api/schools/${encodeURIComponent(schoolId)}/onboarding`;
  const [plans, setPlans] = useState<Plan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0, completed: 0, overdue: 0, inProgress: 0,
  });
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const [staffProfileId, setStaffProfileId] = useState("");
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(baseUrl, {
        cache: "no-store",
        signal,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Unable to load onboarding plans.");
      }
      const nextPlans = result.plans as Plan[];
      setPlans(nextPlans);
      setEmployees(result.eligibleEmployees as Employee[]);
      setStats(result.stats as Stats);
      setSelectedId((current) =>
        nextPlans.some((plan) => plan.id === current)
          ? current
          : nextPlans[0]?.id ?? "",
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to load onboarding.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const selected = useMemo(
    () => plans.find((plan) => plan.id === selectedId) ?? null,
    [plans, selectedId],
  );

  const loadReadiness = useCallback(async (onboardingId: string) => {
    setReadinessLoading(true);
    try {
      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(onboardingId)}/readiness`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to check readiness.");
      setReadiness(result.readiness as Readiness);
    } catch (err) {
      setReadiness(null);
      setError(err instanceof Error ? err.message : "Unable to check readiness.");
    } finally {
      setReadinessLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!selectedId) {
      setReadiness(null);
      return;
    }
    void loadReadiness(selectedId);
  }, [selectedId, loadReadiness]);

  async function completePlan() {
    if (!selected || selected.completedAt) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(selected.id)}/complete`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok) {
        if (Array.isArray(result?.blockers)) {
          setReadiness({
            onboardingId: selected.id,
            completedAt: null,
            ready: false,
            blockers: result.blockers,
          });
        }
        throw new Error(
          Array.isArray(result?.blockers)
            ? `${result.error} ${result.blockers.join(" ")}`
            : result?.error || "Unable to complete onboarding.",
        );
      }
      setNotice("Onboarding completed and recorded.");
      await load();
      await loadReadiness(selected.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete onboarding.");
    } finally {
      setSaving(false);
    }
  }

  async function submitPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffProfileId,
          startDate,
          targetCompletionDate: targetDate || null,
          notes,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to create plan.");
      setStaffProfileId("");
      setTargetDate("");
      setNotes("");
      setNotice("Onboarding plan created.");
      await load();
      if (result.plan?.id) setSelectedId(result.plan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create plan.");
    } finally {
      setSaving(false);
    }
  }

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(selected.id)}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskTitle,
            description: taskDescription,
            dueDate: taskDueDate || null,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to add task.");
      setTaskTitle("");
      setTaskDescription("");
      setTaskDueDate("");
      setNotice("Checklist task added.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add task.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task: Task) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${baseUrl}/tasks/${encodeURIComponent(task.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: task.status === "COMPLETED" ? "PENDING" : "COMPLETED",
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to update task.");
      setNotice("Task status updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Staff onboarding</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prepare new employees with structured onboarding plans and checklists.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || saving}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-input px-3 font-medium hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Total plans", value: stats.total, icon: ClipboardList },
          { label: "Completed", value: stats.completed, icon: CheckCircle2 },
          { label: "In progress", value: stats.inProgress, icon: Users },
          { label: "Overdue", value: stats.overdue, icon: Clock3 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span>{item.label}</span>
                <Icon className="size-4" />
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
        <form onSubmit={submitPlan} className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="font-semibold">Create onboarding plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select an active employee who does not already have a plan.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="font-medium">Employee <span className="text-destructive">*</span></span>
            <select
              required
              value={staffProfileId}
              onChange={(event) => setStaffProfileId(event.target.value)}
              disabled={saving || employees.length === 0}
              className={inputClass}
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employeeName(employee)} · {employee.employeeNumber}
                </option>
              ))}
            </select>
            {employees.length === 0 && (
              <span className="text-xs text-muted-foreground">
                No eligible active employees available.
              </span>
            )}
          </label>

          <label className="block space-y-1.5">
            <span className="font-medium">Onboarding start date <span className="text-destructive">*</span></span>
            <input
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClass}
              disabled={saving}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-medium">Target completion date</span>
            <input
              type="date"
              value={targetDate}
              min={startDate || undefined}
              onChange={(event) => setTargetDate(event.target.value)}
              className={inputClass}
              disabled={saving}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="font-medium">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Role-specific instructions or additional context"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
              disabled={saving}
            />
          </label>

          <button
            type="submit"
            disabled={saving || employees.length === 0 || !staffProfileId || !startDate}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="size-4" />
            {saving ? "Saving…" : "Create plan"}
          </button>
        </form>

        <section className="min-w-0 space-y-4">
          <div>
            <h2 className="font-semibold">Onboarding plans</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a plan to review its progress and manage checklist tasks.
            </p>
          </div>

          {loading && plans.length === 0 ? (
            <div className="rounded-xl border border-border p-6 text-sm text-muted-foreground">
              Loading onboarding plans…
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <ClipboardList className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No onboarding plans yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a plan for an eligible employee to get started.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((plan) => (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => setSelectedId(plan.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    selectedId === plan.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{employeeName(plan.staffProfile)}</span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
                      plan.completedAt
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {plan.completedAt ? "Completed" : "In progress"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.staffProfile.employeeNumber}
                    {plan.staffProfile.jobTitle ? ` · ${plan.staffProfile.jobTitle}` : ""}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    Started {dateLabel(plan.startDate)}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {plan.tasks.filter((task) => task.status === "COMPLETED").length} of {plan.tasks.length} tasks completed
                  </p>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="space-y-5 rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{employeeName(selected.staffProfile)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected.staffProfile.jobTitle || "Role not specified"}
                    {selected.staffProfile.department ? ` · ${selected.staffProfile.department}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {selected.completedAt
                    ? `Completed ${dateLabel(selected.completedAt)}`
                    : `Target: ${dateLabel(selected.targetCompletionDate)}`}
                </span>
              </div>

              {selected.notes && (
                <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
                  {selected.notes}
                </p>
              )}

              <section className="space-y-3 rounded-lg border border-border p-4" aria-live="polite">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold">Completion readiness</h4>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                    selected.completedAt
                      ? "bg-primary/10 text-primary"
                      : readiness?.ready
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {selected.completedAt ? "Completed" : readinessLoading ? "Checking…" : readiness?.ready ? "Ready to complete" : "Action required"}
                  </span>
                </div>
                {readinessLoading ? (
                  <p className="text-sm text-muted-foreground">Checking required documents, employment details, acknowledgements, reviews and tasks…</p>
                ) : readiness?.blockers.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {readiness.blockers.map((blocker, index) => <li key={`${index}-${blocker}`}>{blocker}</li>)}
                  </ul>
                ) : readiness?.ready ? (
                  <p className="text-sm text-muted-foreground">All configured onboarding requirements are satisfied.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Readiness could not be confirmed. Refresh to try again.</p>
                )}
                {!selected.completedAt && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void loadReadiness(selected.id)}
                      disabled={saving || readinessLoading}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-input px-3 font-medium hover:bg-muted disabled:opacity-60"
                    >
                      <RefreshCw className={`size-4 ${readinessLoading ? "animate-spin" : ""}`} />
                      Check again
                    </button>
                    <button
                      type="button"
                      onClick={() => void completePlan()}
                      disabled={saving || readinessLoading || !readiness?.ready}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      <CheckCircle2 className="size-4" />
                      {saving ? "Saving…" : "Complete onboarding"}
                    </button>
                  </div>
                )}
              </section>

              <OnboardingWorkflows schoolId={schoolId} schoolRole={schoolRole} onboardingId={selected.id} employeeName={employeeName(selected.staffProfile)} completed={Boolean(selected.completedAt)} />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold">Onboarding checklist</h4>
                  <span className="text-xs text-muted-foreground">
                    {selected.tasks.filter((task) => task.status === "COMPLETED").length}/{selected.tasks.length} complete
                  </span>
                </div>

                {selected.tasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No checklist tasks yet. Add the first task below.
                  </p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {selected.tasks.map((task) => (
                      <label key={task.id} className="flex items-start gap-3 p-3">
                        {task.status === "COMPLETED" ? (
                          <span
                            aria-label="Completed"
                            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold leading-none text-white"
                          >
                            ✓
                          </span>
                        ) : (
                          <span
                            aria-label="Pending"
                            className="mt-0.5 size-5 shrink-0"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className={`block font-medium ${
                            task.status === "COMPLETED" ? "font-medium text-blue-600 dark:text-blue-400" : ""
                          }`}>
                            {task.title}
                          </span>
                          {task.description && (
                            <span className="mt-1 block whitespace-pre-wrap text-sm text-muted-foreground">
                              {task.description}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Due {dateLabel(task.dueDate)}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {task.status === "COMPLETED" ? "Done" : "Pending"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {!selected.completedAt && (
                <form onSubmit={addTask} className="space-y-3 border-t border-border pt-4">
                  <h4 className="font-semibold">Add checklist task</h4>
                  <label className="block space-y-1.5">
                    <span className="font-medium">Task title <span className="text-destructive">*</span></span>
                    <input
                      required
                      maxLength={160}
                      value={taskTitle}
                      onChange={(event) => setTaskTitle(event.target.value)}
                      placeholder="e.g. Complete staff orientation"
                      className={inputClass}
                      disabled={saving}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="font-medium">Description</span>
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={taskDescription}
                      onChange={(event) => setTaskDescription(event.target.value)}
                      placeholder="Instructions or supporting details"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                      disabled={saving}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="font-medium">Due date</span>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(event) => setTaskDueDate(event.target.value)}
                      className={inputClass}
                      disabled={saving}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={saving || !taskTitle.trim()}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-input px-3 font-medium hover:bg-muted disabled:opacity-60"
                  >
                    <Plus className="size-4" />
                    Add task
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
