"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BookOpen,
  Check,
  CircleAlert,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";

type Subject = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { offerings: number };
};

type Draft = {
  name: string;
  code: string;
  description: string;
};

const emptyDraft: Draft = { name: "", code: "", description: "" };

export function SubjectManagement({ schoolId }: { schoolId: string }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const endpoint = `/api/schools/${encodeURIComponent(schoolId)}/subjects`;

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load subjects.");
      }

      setSubjects(result.subjects as Subject[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load subjects.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    return subjects.filter((subject) => {
      const matchesSearch =
        !query ||
        subject.name.toLowerCase().includes(query) ||
        subject.code.toLowerCase().includes(query) ||
        (subject.description ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && subject.isActive) ||
        (statusFilter === "INACTIVE" && !subject.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [subjects, search, statusFilter]);

  function openCreate() {
    setDraft(emptyDraft);
    setEditingId(null);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function openEdit(subject: Subject) {
    setDraft({
      name: subject.name,
      code: subject.code,
      description: subject.description ?? "",
    });
    setEditingId(subject.id);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function saveSubject(event: FormEvent<HTMLFormElement>) {
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
            name: draft.name.trim(),
            code: draft.code.trim().toUpperCase(),
            description: draft.description.trim() || null,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save subject.");
      }

      const wasEditing = Boolean(editingId);
      setFormOpen(false);
      setEditingId(null);
      setDraft(emptyDraft);
      setNotice(wasEditing ? "Subject updated." : "Subject created.");
      await loadSubjects();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save subject.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(subject: Subject) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(subject.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !subject.isActive }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update subject status.");
      }

      setNotice(subject.isActive ? "Subject deactivated." : "Subject activated.");
      await loadSubjects();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update subject status.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = subjects.filter((subject) => subject.isActive).length;
  const offeringCount = subjects.reduce(
    (total, subject) => total + subject._count.offerings,
    0,
  );

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="size-5" />
          </div>
          <div>
            <p className="mt-2 text-sm font-medium text-primary">Academic structure</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Subjects
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Maintain your school’s subject catalog. Subjects can be offered to
              individual sections and assigned to eligible teachers.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadSubjects()}
            disabled={loading || saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="size-4" />
            New subject
          </button>
        </div>
      </section>

      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 ${
            error
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {error ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Check className="mt-0.5 size-4 shrink-0" />
          )}
          <p className="min-w-0 flex-1 text-sm">{error || notice}</p>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total subjects</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{subjects.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Configured in this school</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Active subjects</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{activeCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Available for new offerings</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Subject offerings</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{offeringCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Section-subject records</p>
        </div>
      </section>

      {formOpen && (
        <section className="overflow-hidden rounded-xl border border-primary/30 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-primary/[0.035] px-5 py-4">
            <div>
              <h2 className="font-semibold">
                {editingId ? "Edit subject" : "Create subject"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Subject names and codes must be unique within this school.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close subject form"
              onClick={() => setFormOpen(false)}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={saveSubject} className="space-y-4 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="min-w-0 space-y-1.5">
                <span className="block text-xs font-medium">Subject name</span>
                <input
                  required
                  maxLength={100}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((old) => ({ ...old, name: event.target.value }))
                  }
                  placeholder="e.g. Mathematics"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="min-w-0 space-y-1.5">
                <span className="block text-xs font-medium">Subject code</span>
                <input
                  required
                  maxLength={30}
                  value={draft.code}
                  onChange={(event) =>
                    setDraft((old) => ({ ...old, code: event.target.value.toUpperCase() }))
                  }
                  placeholder="e.g. MATH"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="min-w-0 space-y-1.5">
                <span className="block text-xs font-medium">
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <input
                  maxLength={500}
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((old) => ({ ...old, description: event.target.value }))
                  }
                  placeholder="Subject details or curriculum notes"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save subject
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold">Subject directory</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Deactivation preserves existing academic records and offering history.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, code, description"
                aria-label="Search subjects"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>

            <select
              aria-label="Filter subject status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <span className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-muted/40 px-3 text-xs text-muted-foreground">
              {filteredSubjects.length} shown
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Loading subjects…
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <BookOpen className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">
              {subjects.length === 0 ? "No subjects configured" : "No matching subjects"}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {subjects.length === 0
                ? "Create the school's subject catalog before linking subjects to sections."
                : "Try another search term or change the status filter."}
            </p>
            {subjects.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="size-4" />
                Create first subject
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Offerings</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSubjects.map((subject) => (
                  <tr key={subject.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{subject.name}</p>
                      {subject.description && (
                        <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">
                          {subject.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs">{subject.code}</td>
                    <td className="px-4 py-3.5 tabular-nums">
                      {subject._count.offerings}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                          subject.isActive
                            ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {subject.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => openEdit(subject)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void toggleActive(subject)}
                          className="h-8 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                        >
                          {subject.isActive ? "Deactivate" : "Activate"}
                        </button>
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
        <p>
          Subjects are isolated to this school. Deactivating a subject prevents
          it from being selected for new offerings through the existing API;
          previously created offerings and academic history are preserved.
        </p>
      </div>
    </div>
  );
}
