"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  X,
} from "lucide-react";

type Grade = {
  id: string;
  name: string;
  code: string;
  level: number;
  description: string | null;
  isActive: boolean;
  _count: { sections: number; enrollments: number };
};

type Draft = {
  name: string;
  code: string;
  level: string;
  description: string;
};

const emptyDraft: Draft = { name: "", code: "", level: "1", description: "" };

export function GradeManagement({ schoolId }: { schoolId: string }) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const endpoint = `/api/schools/${encodeURIComponent(schoolId)}/grades`;

  const loadGrades = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load grades.");
      setGrades(result.grades);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load grades.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void loadGrades();
  }, [loadGrades]);

  function openCreate() {
    setDraft(emptyDraft);
    setEditingId(null);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function openEdit(grade: Grade) {
    setDraft({
      name: grade.name,
      code: grade.code,
      level: String(grade.level),
      description: grade.description ?? "",
    });
    setEditingId(grade.id);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        editingId ? `${endpoint}/${encodeURIComponent(editingId)}` : endpoint,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            code: draft.code,
            level: Number(draft.level),
            description: draft.description,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save grade.");

      setFormOpen(false);
      setEditingId(null);
      setDraft(emptyDraft);
      setNotice(editingId ? "Grade updated." : "Grade created.");
      await loadGrades();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save grade.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(grade: Grade) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(grade.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !grade.isActive }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update grade status.");
      setNotice(grade.isActive ? "Grade deactivated." : "Grade activated.");
      await loadGrades();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update grade status.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = grades.filter((grade) => grade.isActive).length;
  const sectionCount = grades.reduce((sum, grade) => sum + grade._count.sections, 0);

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <p className="mt-2 text-sm font-medium text-primary">Academic structure</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Grades</h1>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              Configure the grade levels your school offers. Sections and study shifts are managed separately.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadGrades()} disabled={loading || saving} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" /> New grade
          </button>
        </div>
      </section>

      {(error || notice) && (
        <div role={error ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-xl border p-3.5 ${error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400"}`}>
          {error ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0" />}
          <p className="min-w-0 flex-1 text-sm">{error || notice}</p>
          <button type="button" aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total grades</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{grades.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Configured grade levels</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Active grades</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{activeCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Available for school operations</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Sections across grades</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{sectionCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Existing section records</p>
        </div>
      </section>

      {formOpen && (
        <section className="overflow-hidden rounded-xl border border-primary/30 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-primary/[0.035] px-5 py-4">
            <div>
              <h2 className="font-semibold">{editingId ? "Edit grade" : "Create grade"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">Grade levels and codes must be unique within this school.</p>
            </div>
            <button type="button" aria-label="Close grade form" onClick={() => setFormOpen(false)} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={saveGrade} className="space-y-4 p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5">
                <span className="block text-xs font-medium">Grade name</span>
                <input required maxLength={100} value={draft.name} onChange={(event) => setDraft((old) => ({ ...old, name: event.target.value }))} placeholder="e.g. Grade 9" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-medium">Grade code</span>
                <input required maxLength={30} value={draft.code} onChange={(event) => setDraft((old) => ({ ...old, code: event.target.value.toUpperCase() }))} placeholder="e.g. G09" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-medium">Level / sequence</span>
                <input required type="number" min={1} max={100} step={1} value={draft.level} onChange={(event) => setDraft((old) => ({ ...old, level: event.target.value }))} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></span>
                <input maxLength={500} value={draft.description} onChange={(event) => setDraft((old) => ({ ...old, description: event.target.value }))} placeholder="Additional details" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setFormOpen(false)} className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
              <button disabled={saving} type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save grade
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold">Grade directory</h2>
            <p className="mt-1 text-xs text-muted-foreground">Manage grade definitions without deleting historical academic records.</p>
          </div>
          <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
            {grades.length} {grades.length === 1 ? "grade" : "grades"}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading grades…
          </div>
        ) : grades.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><GraduationCap className="size-5" /></div>
            <h3 className="mt-4 text-base font-semibold">No grades configured</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">Create your first grade level to start building the school’s academic structure.</p>
            <button type="button" onClick={openCreate} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="size-4" /> Create first grade</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Grade</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Sections</th>
                  <th className="px-4 py-3">Enrollments</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {grades.map((grade) => (
                  <tr key={grade.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{grade.name}</p>
                      {grade.description && <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{grade.description}</p>}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs">{grade.code}</td>
                    <td className="px-4 py-3.5 tabular-nums">{grade.level}</td>
                    <td className="px-4 py-3.5 tabular-nums">{grade._count.sections}</td>
                    <td className="px-4 py-3.5 tabular-nums">{grade._count.enrollments}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${grade.isActive ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {grade.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <button type="button" disabled={saving} onClick={() => openEdit(grade)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50"><Pencil className="size-3.5" /> Edit</button>
                        <button type="button" disabled={saving} onClick={() => void toggleActive(grade)} className="h-8 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50">{grade.isActive ? "Deactivate" : "Activate"}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <p>Grades belong to this school only. Deactivating a grade preserves its sections and enrollment history. Study shifts will be configured independently, so the same grade can support morning, afternoon, evening, or weekend sections.</p>
      </div>
    </div>
  );
}
