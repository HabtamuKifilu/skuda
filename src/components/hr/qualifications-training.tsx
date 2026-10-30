"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, BookOpen, GraduationCap, LoaderCircle, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { EmployeeDocuments } from "@/components/hr/employee-documents";

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

type Training = {
  id: string;
  staffProfileId: string;
  title: string;
  provider: string | null;
  trainingType: string | null;
  description: string | null;
  startDate: string;
  endDate: string | null;
  completionDate: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  outcome: string | null;
  notes: string | null;
  staffProfile: Employee;
};

type Qualification = {
  id: string;
  staffProfileId: string;
  documentType: string;
  title: string;
  expiryDate: string | null;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  staffProfile: Omit<Employee, "status">;
};

type Stats = {
  total: number;
  pendingReview: number;
  rejected: number;
  expired: number;
  expiringSoon: number;
};

type Payload = {
  staffProfileId: string;
  title: string;
  provider: string;
  trainingType: string;
  description: string;
  startDate: string;
  endDate: string;
  completionDate: string;
  status: Training["status"];
  outcome: string;
  notes: string;
};

const emptyForm = (): Payload => ({
  staffProfileId: "",
  title: "",
  provider: "",
  trainingType: "",
  description: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  completionDate: "",
  status: "PLANNED",
  outcome: "",
  notes: "",
});

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

function employeeName(employee: Employee | Qualification["staffProfile"]) {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ");
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function QualificationsTraining({ schoolId }: { schoolId: string }) {
  const baseUrl = `/api/schools/${encodeURIComponent(schoolId)}/training`;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Training[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0, pendingReview: 0, rejected: 0, expired: 0, expiringSoon: 0,
  });
  const [trainingStats, setTrainingStats] = useState({
    total: 0, planned: 0, inProgress: 0, completed: 0, cancelled: 0,
  });
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [form, setForm] = useState<Payload>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Training | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(baseUrl, { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to load qualifications and training.");
      setEmployees(result.employees);
      setRecords(result.records);
      setQualifications(result.qualifications);
      setStats(result.qualificationStats);
      setTrainingStats(result.trainingStats);
      setSelectedEmployee((current) =>
        result.employees.some((employee: Employee) => employee.id === current)
          ? current
          : result.employees[0]?.id ?? "",
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setEmployees([]);
      setRecords([]);
      setQualifications([]);
      setStats({ total: 0, pendingReview: 0, rejected: 0, expired: 0, expiringSoon: 0 });
      setTrainingStats({ total: 0, planned: 0, inProgress: 0, completed: 0, cancelled: 0 });
      setSelectedEmployee("");
      setError(err instanceof Error ? err.message : "Unable to load the workspace.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const visibleRecords = useMemo(() => records.filter((record) => {
    if (filter === "ALL") return true;
    return record.status === filter;
  }), [records, filter]);

  function startCreate() {
    setEditingId("");
    setForm({ ...emptyForm(), staffProfileId: selectedEmployee || employees[0]?.id || "" });
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function startEdit(record: Training) {
    setEditingId(record.id);
    setForm({
      staffProfileId: record.staffProfileId,
      title: record.title,
      provider: record.provider ?? "",
      trainingType: record.trainingType ?? "",
      description: record.description ?? "",
      startDate: record.startDate.slice(0, 10),
      endDate: record.endDate?.slice(0, 10) ?? "",
      completionDate: record.completionDate?.slice(0, 10) ?? "",
      status: record.status,
      outcome: record.outcome ?? "",
      notes: record.notes ?? "",
    });
    setShowForm(true);
    setError("");
    setNotice("");
  }

  async function saveTraining(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (form.endDate && form.endDate < form.startDate) {
      setError("End date cannot precede start date.");
      return;
    }
    if (form.completionDate && form.completionDate < form.startDate) {
      setError("Completion date cannot precede start date.");
      return;
    }
    if (form.status === "COMPLETED" && !form.completionDate) {
      setError("Enter a completion date for completed training.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        editingId ? `${baseUrl}/${encodeURIComponent(editingId)}` : baseUrl,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            endDate: form.endDate || null,
            completionDate: form.completionDate || null,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to save training.");
      setSelectedEmployee(form.staffProfileId);
      setShowForm(false);
      setEditingId("");
      setNotice(editingId ? "Training record updated." : "Training record created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save training.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTraining(record: Training) {
    if (deleting) return;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${baseUrl}/${encodeURIComponent(record.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to delete training.");
      setDeleteTarget(null);
      setNotice("Training record deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete training.");
    } finally {
      setDeleting(false);
    }
  }

  const today = new Date();
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const expiryCutoff = utcToday + 60 * 86400000;

  const qualificationAlerts = qualifications.filter((item) => {
    if (item.reviewStatus !== "APPROVED") return true;
    if (!item.expiryDate) return false;
    const expiry = new Date(item.expiryDate).getTime();
    return Number.isFinite(expiry) && expiry <= expiryCutoff;
  });

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">People &amp; HR</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Qualifications &amp; training</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Verify staff credentials, monitor expiry dates, and maintain a school-wide record of professional development.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 font-medium hover:bg-muted disabled:opacity-60">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">{notice}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Credentials on file", value: stats.total, icon: GraduationCap },
          { label: "Awaiting review", value: stats.pendingReview, icon: BookOpen },
          { label: "Expired credentials", value: stats.expired, icon: AlertTriangle },
          { label: "Expiring within 60 days", value: stats.expiringSoon, icon: AlertTriangle },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{item.label}</span><item.icon className="size-4" />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Qualification register</h2>
            <p className="mt-1 text-sm text-muted-foreground">Review status, employee credentials, and upcoming expiry dates.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Employee</span>
            <select className={`${inputClass} min-w-48`} value={selectedEmployee}
              onChange={(event) => setSelectedEmployee(event.target.value)}>
              {employees.length === 0 && <option value="">No employees available</option>}
              {employees.map((employee) => <option key={employee.id} value={employee.id}>
                {employeeName(employee)} · {employee.employeeNumber}
              </option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-0 border-b border-border sm:grid-cols-3">
          {[
            { label: "Rejected", value: stats.rejected },
            { label: "Credentials needing attention", value: qualificationAlerts.length },
            { label: "Total staff", value: employees.length },
          ].map((item) => <div key={item.label} className="border-b border-border p-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-0">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{item.value}</p>
          </div>)}
        </div>

        {qualificationAlerts.length > 0 && (
          <div className="border-b border-border p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-amber-600" /> Credentials needing attention</h3>
            <div className="space-y-2">
              {qualificationAlerts.slice(0, 8).map((item) => (
                <div key={item.id} className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{employeeName(item.staffProfile)} · {item.documentType.replaceAll("_", " ")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {item.reviewStatus !== "APPROVED" && (
                      <span className={`rounded-full px-2 py-1 ${item.reviewStatus === "REJECTED" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700"}`}>
                        {statusLabel(item.reviewStatus)}
                      </span>
                    )}
                    {item.expiryDate && (() => {
                      const expiry = new Date(item.expiryDate).getTime();
                      const expired = Number.isFinite(expiry) && expiry < utcToday;
                      const expiringSoon = Number.isFinite(expiry) && expiry >= utcToday && expiry < expiryCutoff;
                      return expired || expiringSoon ? (
                        <span className={`rounded-full px-2 py-1 ${expired ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700"}`}>
                          {expired ? "Expired" : "Expiring within 60 days"}
                        </span>
                      ) : null;
                    })()}
                    {item.expiryDate && <span className="text-muted-foreground">Expires: {dateLabel(item.expiryDate)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedEmployee ? (
          <div className="p-4 sm:p-5">
            <EmployeeDocuments schoolId={schoolId} staffId={selectedEmployee} />
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Add an employee before managing qualification documents.</p>
        )}
      </section>

      <section id="training" className="scroll-mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Staff training register</h2>
            <p className="mt-1 text-sm text-muted-foreground">Track planned courses, in-progress learning, completion dates, and outcomes.</p>
          </div>
          <button type="button" onClick={startCreate} disabled={employees.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <Plus className="size-4" /> Add training
          </button>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
          {[
            ["Total", trainingStats.total],
            ["Planned", trainingStats.planned],
            ["In progress", trainingStats.inProgress],
            ["Completed", trainingStats.completed],
            ["Cancelled", trainingStats.cancelled],
          ].map(([label, value]) => <div key={label} className="bg-card p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
          </div>)}
        </div>

        {showForm && (
          <form onSubmit={saveTraining} className="space-y-4 border-b border-border bg-muted/20 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editingId ? "Edit training record" : "New training record"}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1.5"><span className="font-medium">Employee *</span>
                <select required className={inputClass} value={form.staffProfileId} onChange={(e) => setForm({ ...form, staffProfileId: e.target.value })}>
                  <option value="">Select employee</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeName(employee)} · {employee.employeeNumber}</option>)}
                </select>
              </label>
              <label className="space-y-1.5"><span className="font-medium">Training title *</span>
                <input required maxLength={160} className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="space-y-1.5"><span className="font-medium">Provider</span>
                <input maxLength={160} className={inputClass} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
              </label>
              <label className="space-y-1.5"><span className="font-medium">Training type</span>
                <input maxLength={120} placeholder="e.g. Certification, workshop" className={inputClass} value={form.trainingType} onChange={(e) => setForm({ ...form, trainingType: e.target.value })} />
              </label>
              <label className="space-y-1.5"><span className="font-medium">Start date *</span>
                <input required type="date" className={inputClass} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </label>
              <label className="space-y-1.5"><span className="font-medium">End date</span>
                <input type="date" min={form.startDate} className={inputClass} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </label>
              <label className="space-y-1.5"><span className="font-medium">Status *</span>
                <select required className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Payload["status"] })}>
                  <option value="PLANNED">Planned</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <label className="space-y-1.5"><span className="font-medium">Completion date{form.status === "COMPLETED" ? " *" : ""}</span>
                <input type="date" required={form.status === "COMPLETED"} min={form.startDate} className={inputClass} value={form.completionDate} onChange={(e) => setForm({ ...form, completionDate: e.target.value })} />
              </label>
              <label className="space-y-1.5"><span className="font-medium">Outcome</span>
                <input maxLength={1000} placeholder="Result, score, or certificate earned" className={inputClass} value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2 lg:col-span-3"><span className="font-medium">Description</span>
                <textarea maxLength={2000} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label className="space-y-1.5 sm:col-span-2 lg:col-span-3"><span className="font-medium">Notes</span>
                <textarea maxLength={2000} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>
            <button disabled={saving} type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60">
              <Save className="size-4" /> {saving ? "Saving…" : editingId ? "Save changes" : "Create training"}
            </button>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <span className="mr-1 text-xs text-muted-foreground">Filter:</span>
          {["ALL", "PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((value) => (
            <button key={value} type="button" onClick={() => setFilter(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filter === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
              {value === "ALL" ? "All statuses" : statusLabel(value)}
            </button>
          ))}
        </div>

        {loading ? <p className="p-6 text-sm text-muted-foreground">Loading training records…</p> :
          visibleRecords.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No training records match this filter.</p> :
          <div className="divide-y divide-border">
            {visibleRecords.map((record) => (
              <article key={record.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{record.title}</h3>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs">{statusLabel(record.status)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {employeeName(record.staffProfile)} · {record.staffProfile.employeeNumber}
                    {record.provider ? ` · ${record.provider}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {record.trainingType || "Training"} · {dateLabel(record.startDate)} – {dateLabel(record.endDate)}
                    {record.completionDate ? ` · Completed ${dateLabel(record.completionDate)}` : ""}
                  </p>
                  {record.outcome && <p className="mt-2 text-sm">Outcome: {record.outcome}</p>}
                  {record.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{record.description}</p>}
                  {record.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">Notes: {record.notes}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => startEdit(record)} className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">Edit</button>
                  <button type="button" onClick={() => { setError(""); setDeleteTarget(record); }} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/5">
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>}
      </section>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-transparent p-4"
          onClick={() => { if (!deleting) { setDeleteTarget(null); setError(""); } }}
          role="presentation"
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="training-delete-title"
            aria-describedby="training-delete-description"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
                  <Trash2 className="size-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id="training-delete-title" className="text-base font-semibold tracking-tight">
                    Delete training record?
                  </h2>
                  <p id="training-delete-description" className="mt-2 text-sm leading-6 text-muted-foreground">
                    This permanently removes this professional development record from the employee’s HR history. This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => { setDeleteTarget(null); setError(""); }}
                  aria-label="Close delete confirmation"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 rounded-xl border border-border bg-muted/30 p-3.5">
                <div className="flex items-start gap-3">
                  <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{deleteTarget.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {employeeName(deleteTarget.staffProfile)} · {deleteTarget.staffProfile.employeeNumber}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {deleteTarget.trainingType || "Training"} · {statusLabel(deleteTarget.status)}
                      {" · "}{dateLabel(deleteTarget.startDate)}
                    </p>
                  </div>
                </div>
              </div>

              {error ? (
                <div role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setDeleteTarget(null); setError(""); }}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => { if (deleteTarget && !deleting) void deleteTraining(deleteTarget); }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-white transition hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting
                  ? <LoaderCircle className="size-4 animate-spin" />
                  : <Trash2 className="size-4" />}
                {deleting ? "Deleting training…" : "Delete permanently"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
