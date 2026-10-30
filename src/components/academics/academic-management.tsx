"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  X,
} from "lucide-react";

type Term = {
  id: string;
  academicYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  sequence: number;
  isCurrent: boolean;
  _count?: { assessments: number };
};

type AcademicYear = {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms: Term[];
  _count?: { sections: number; enrollments: number };
};

type YearDraft = {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

type TermDraft = {
  name: string;
  startDate: string;
  endDate: string;
  sequence: string;
  isCurrent: boolean;
};

const emptyYear: YearDraft = {
  name: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
};

const emptyTerm: TermDraft = {
  name: "",
  startDate: "",
  endDate: "",
  sequence: "1",
  isCurrent: false,
};

function dateValue(value: string) {
  return value ? value.slice(0, 10) : "";
}

function displayDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
}) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
      />
    </label>
  );
}

function CurrentToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-input accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}

export function AcademicManagement({ schoolId }: { schoolId: string }) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [yearEditor, setYearEditor] = useState<"create" | string | null>(null);
  const [yearDraft, setYearDraft] = useState<YearDraft>(emptyYear);
  const [termEditor, setTermEditor] = useState<{
    yearId: string;
    termId: string | null;
  } | null>(null);
  const [termDraft, setTermDraft] = useState<TermDraft>(emptyTerm);

  const loadYears = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/academic-years`,
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load academic years.");
      }

      const records = result.academicYears as AcademicYear[];
      setYears(records);
      setExpanded((previous) => {
        if (previous && records.some((year) => year.id === previous)) {
          return previous;
        }
        return records.find((year) => year.isCurrent)?.id ?? records[0]?.id ?? null;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load academic years.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadYears();
  }, [loadYears]);

  async function send(
    url: string,
    method: "POST" | "PATCH",
    payload: Record<string, string | boolean | number>,
  ) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "The operation could not be completed.");
    }
    return result;
  }

  function openCreateYear() {
    setError("");
    setNotice("");
    setYearDraft(emptyYear);
    setYearEditor("create");
    setTermEditor(null);
  }

  function openEditYear(year: AcademicYear) {
    setError("");
    setNotice("");
    setYearDraft({
      name: year.name,
      startDate: dateValue(year.startDate),
      endDate: dateValue(year.endDate),
      isCurrent: year.isCurrent,
    });
    setYearEditor(year.id);
    setTermEditor(null);
  }

  async function saveYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...yearDraft,
        startDate: yearDraft.startDate,
        endDate: yearDraft.endDate,
      };

      if (yearEditor === "create") {
        await send(
          `/api/schools/${encodeURIComponent(schoolId)}/academic-years`,
          "POST",
          payload,
        );
        setNotice("Academic year created.");
      } else if (yearEditor) {
        await send(
          `/api/schools/${encodeURIComponent(schoolId)}/academic-years`,
          "PATCH",
          { ...payload, id: yearEditor },
        );
        setNotice("Academic year updated.");
      }

      setYearEditor(null);
      await loadYears();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the academic year.");
    } finally {
      setSaving(false);
    }
  }

  function openCreateTerm(year: AcademicYear) {
    setError("");
    setNotice("");
    setExpanded(year.id);
    setTermDraft({
      ...emptyTerm,
      sequence: String(year.terms.length + 1),
      startDate: dateValue(year.startDate),
      endDate: dateValue(year.endDate),
    });
    setTermEditor({ yearId: year.id, termId: null });
    setYearEditor(null);
  }

  function openEditTerm(year: AcademicYear, term: Term) {
    setError("");
    setNotice("");
    setExpanded(year.id);
    setTermDraft({
      name: term.name,
      startDate: dateValue(term.startDate),
      endDate: dateValue(term.endDate),
      sequence: String(term.sequence),
      isCurrent: term.isCurrent,
    });
    setTermEditor({ yearId: year.id, termId: term.id });
    setYearEditor(null);
  }

  async function saveTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termEditor) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const url =
        `/api/schools/${encodeURIComponent(schoolId)}/academic-years/` +
        `${encodeURIComponent(termEditor.yearId)}/terms`;

      const payload = {
        ...termDraft,
        sequence: Number(termDraft.sequence),
      };

      if (termEditor.termId) {
        await send(
          `${url}/${encodeURIComponent(termEditor.termId)}`,
          "PATCH",
          payload,
        );
        setNotice("Term updated.");
      } else {
        await send(url, "POST", payload);
        setNotice("Term created.");
      }

      setTermEditor(null);
      await loadYears();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the term.");
    } finally {
      setSaving(false);
    }
  }

  const currentYear = years.find((year) => year.isCurrent);
  const totalTerms = years.reduce((total, year) => total + year.terms.length, 0);

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">Academic operations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Academics
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              Configure academic years and terms for your school.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadYears()}
            disabled={loading || saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreateYear}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="size-4" />
            New academic year
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
          {error ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0" />}
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
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Academic years</span>
            <CalendarDays className="size-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{years.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Configured for this school</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Current academic year</span>
            <Check className="size-4" />
          </div>
          <p className="mt-3 truncate text-lg font-semibold">
            {currentYear?.name ?? "Not set"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentYear
              ? `${displayDate(currentYear.startDate)} – ${displayDate(currentYear.endDate)}`
              : "Choose a year and mark it current"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-sm">Academic terms</span>
            <Clock3 className="size-4" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{totalTerms}</p>
          <p className="mt-1 text-xs text-muted-foreground">Across all academic years</p>
        </div>
      </section>

      {yearEditor && (
        <section className="overflow-hidden rounded-xl border border-primary/30 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-primary/[0.035] px-5 py-4">
            <div>
              <h2 className="font-semibold">
                {yearEditor === "create" ? "Create academic year" : "Edit academic year"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                The dates must contain every term configured for this year.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close academic year form"
              onClick={() => setYearEditor(null)}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={saveYear} className="space-y-4 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Academic year name" value={yearDraft.name} onChange={(name) => setYearDraft((old) => ({ ...old, name }))} />
              <Field label="Start date" type="date" value={yearDraft.startDate} onChange={(startDate) => setYearDraft((old) => ({ ...old, startDate }))} />
              <Field label="End date" type="date" value={yearDraft.endDate} min={yearDraft.startDate || undefined} onChange={(endDate) => setYearDraft((old) => ({ ...old, endDate }))} />
            </div>
            <CurrentToggle
              label="Set as current academic year"
              checked={yearDraft.isCurrent}
              onChange={(isCurrent) => setYearDraft((old) => ({ ...old, isCurrent }))}
            />
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setYearEditor(null)} className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
              <button disabled={saving} type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save academic year
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold">Academic calendar</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage year dates, term sequences, and the current period.
            </p>
          </div>
          <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
            {years.length} {years.length === 1 ? "year" : "years"}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Loading academic calendar…
          </div>
        ) : years.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <CalendarDays className="size-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">No academic years yet</h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
              Create your school’s academic year first, then add terms and set the current period.
            </p>
            <button type="button" onClick={openCreateYear} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4" />
              Create first academic year
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {years.map((year) => {
              const isExpanded = expanded === year.id;
              const isEditing = yearEditor === year.id;
              const isAddingTerm = termEditor?.yearId === year.id && termEditor.termId === null;

              return (
                <article key={year.id}>
                  <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : year.id)}
                      aria-expanded={isExpanded}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{year.name}</span>
                          {year.isCurrent && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/20 bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              <Check className="size-3" />
                              Current
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {displayDate(year.startDate)} – {displayDate(year.endDate)}
                        </span>
                        <span className="mt-1.5 block text-xs text-muted-foreground">
                          {year.terms.length} terms
                          {" · "}
                          {year._count?.sections ?? 0} sections
                          {" · "}
                          {year._count?.enrollments ?? 0} enrollments
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => openEditYear(year)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        <Pencil className="size-3.5" />
                        Edit year
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => openCreateTerm(year)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
                      >
                        <Plus className="size-3.5" />
                        Add term
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-3 border-t border-border bg-muted/20 px-5 py-4 sm:pl-16">
                      {year.terms.length === 0 && !isAddingTerm ? (
                        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center">
                          <p className="text-sm font-medium">No terms configured</p>
                          <p className="mt-1 text-xs text-muted-foreground">Add the first term for {year.name}.</p>
                          <button type="button" onClick={() => openCreateTerm(year)} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-muted">
                            <Plus className="size-3.5" />
                            Add term
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-lg border border-border bg-card">
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <span>Term and dates</span>
                            <span>Sequence</span>
                          </div>
                          {year.terms.map((term) => (
                            <div key={term.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                              <div className="flex min-w-0 items-start gap-3">
                                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
                                  {term.sequence}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium">{term.name}</p>
                                    {term.isCurrent && (
                                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Current term</span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {displayDate(term.startDate)} – {displayDate(term.endDate)}
                                  </p>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {term._count?.assessments ?? 0} assessments
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => openEditTerm(year, term)}
                                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                              >
                                <Pencil className="size-3.5" />
                                Edit
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {isAddingTerm && (
                        <TermForm
                          title={`Add term to ${year.name}`}
                          draft={termDraft}
                          year={year}
                          saving={saving}
                          onChange={setTermDraft}
                          onCancel={() => setTermEditor(null)}
                          onSubmit={saveTerm}
                        />
                      )}

                      {termEditor?.yearId === year.id && termEditor.termId && (
                        <TermForm
                          title={`Edit ${termDraft.name}`}
                          draft={termDraft}
                          year={year}
                          saving={saving}
                          onChange={setTermDraft}
                          onCancel={() => setTermEditor(null)}
                          onSubmit={saveTerm}
                        />
                      )}

                      {isEditing && (
                        <p className="text-xs text-muted-foreground">
                          The academic-year editor is open above. Existing terms must remain within its date range.
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Academic-year and term changes are restricted to authorized school roles and recorded in the audit log. Setting a year or term as current clears the previous current selection at the corresponding level.
        </p>
      </div>
    </div>
  );
}

function TermForm({
  title,
  draft,
  year,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: {
  title: string;
  draft: TermDraft;
  year: AcademicYear;
  saving: boolean;
  onChange: (draft: TermDraft | ((previous: TermDraft) => TermDraft)) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-primary/30 bg-card">
      <div className="flex items-center justify-between border-b border-border bg-primary/[0.035] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Dates must fall within {year.name}.
          </p>
        </div>
        <button type="button" aria-label="Close term form" onClick={onCancel} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Term name" value={draft.name} onChange={(name) => onChange((old) => ({ ...old, name }))} />
          <Field label="Start date" type="date" min={dateValue(year.startDate)} max={dateValue(year.endDate)} value={draft.startDate} onChange={(startDate) => onChange((old) => ({ ...old, startDate }))} />
          <Field label="End date" type="date" min={draft.startDate || dateValue(year.startDate)} max={dateValue(year.endDate)} value={draft.endDate} onChange={(endDate) => onChange((old) => ({ ...old, endDate }))} />
          <Field label="Sequence" type="number" min="1" value={draft.sequence} onChange={(sequence) => onChange((old) => ({ ...old, sequence }))} />
        </div>
        <CurrentToggle
          label="Set as current term"
          checked={draft.isCurrent}
          onChange={(isCurrent) => onChange((old) => ({ ...old, isCurrent }))}
        />
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
          <button disabled={saving} type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save term
          </button>
        </div>
      </form>
    </section>
  );
}
