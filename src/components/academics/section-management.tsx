"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  CircleAlert,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";

type Grade = {
  id: string;
  name: string;
  code: string;
  level: number;
  isActive: boolean;
  _count?: { sections: number; enrollments: number };
};

type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms: { id: string; name: string }[];
  _count: { sections: number; enrollments: number };
};

type Shift = {
  id: string;
  name: string;
  code: string;
  type: string;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
  _count?: { sections: number };
};

type Section = {
  id: string;
  academicYearId: string;
  gradeId: string;
  studyShiftId: string | null;
  name: string;
  code: string;
  capacity: number | null;
  isActive: boolean;
  academicYear: { id: string; name: string; isCurrent: boolean };
  grade: { id: string; name: string; code: string; level: number; isActive: boolean };
  studyShift: {
    id: string;
    name: string;
    type: string;
    startMinute: number;
    endMinute: number;
    isActive: boolean;
  } | null;
  _count: { enrollments: number; subjectOfferings: number; timetableEntries: number };
};

type Draft = {
  academicYearId: string;
  gradeId: string;
  studyShiftId: string;
  name: string;
  code: string;
  capacity: string;
};

const emptyDraft: Draft = {
  academicYearId: "",
  gradeId: "",
  studyShiftId: "",
  name: "",
  code: "",
  capacity: "",
};

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "block space-y-1.5";
const labelTextClass = "block text-xs font-medium";

function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function statusClass(active: boolean) {
  return active
    ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
    : "bg-muted text-muted-foreground";
}

export function SectionManagement({ schoolId }: { schoolId: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [shiftFilter, setShiftFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const base = `/api/schools/${encodeURIComponent(schoolId)}`;
  const endpoint = `${base}/sections`;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all([
        fetch(endpoint),
        fetch(`${base}/grades`),
        fetch(`${base}/academic-years`),
        fetch(`${base}/study-shifts`),
      ]);
      const results = await Promise.all(responses.map(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load academic structure.");
        return result;
      }));
      setSections(results[0].sections);
      setGrades(results[1].grades);
      setAcademicYears(results[2].academicYears);
      setShifts(results[3].shifts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load sections.");
    } finally {
      setLoading(false);
    }
  }, [base, endpoint]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreate() {
    const currentYear = academicYears.find((year) => year.isCurrent) ?? academicYears[0];
    const firstGrade = grades.find((grade) => grade.isActive);
    setDraft({
      ...emptyDraft,
      academicYearId: currentYear?.id ?? "",
      gradeId: firstGrade?.id ?? "",
    });
    setEditingId(null);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function openEdit(section: Section) {
    setDraft({
      academicYearId: section.academicYearId,
      gradeId: section.gradeId,
      studyShiftId: section.studyShiftId ?? "",
      name: section.name,
      code: section.code,
      capacity: section.capacity == null ? "" : String(section.capacity),
    });
    setEditingId(section.id);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function saveSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const capacity = draft.capacity.trim() === "" ? null : Number(draft.capacity);
      if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
        throw new Error("Capacity must be a positive whole number.");
      }

      const response = await fetch(
        editingId ? `${endpoint}/${encodeURIComponent(editingId)}` : endpoint,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            academicYearId: draft.academicYearId,
            gradeId: draft.gradeId,
            studyShiftId: draft.studyShiftId || null,
            name: draft.name.trim(),
            code: draft.code.trim().toUpperCase(),
            capacity,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save section.");

      setFormOpen(false);
      setEditingId(null);
      setDraft(emptyDraft);
      setNotice(editingId ? "Section updated." : "Section created.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save section.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(section: Section) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(section.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !section.isActive }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update section status.");
      setNotice(section.isActive ? "Section deactivated." : "Section activated.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update section status.");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = sections.filter((section) => section.isActive).length;
  const enrollmentCount = sections.reduce((sum, section) => sum + section._count.enrollments, 0);
  const unassignedCount = sections.filter((section) => !section.studyShiftId).length;

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sections.filter((section) => {
      const matchesSearch = !query || [
        section.name,
        section.code,
        section.grade.name,
        section.grade.code,
        section.academicYear.name,
        section.studyShift?.name ?? "",
      ].some((value) => value.toLowerCase().includes(query));
      const matchesYear = yearFilter === "ALL" || section.academicYearId === yearFilter;
      const matchesGrade = gradeFilter === "ALL" || section.gradeId === gradeFilter;
      const matchesShift = shiftFilter === "ALL"
        || (shiftFilter === "NONE" ? !section.studyShiftId : section.studyShiftId === shiftFilter);
      const matchesStatus = statusFilter === "ALL"
        || (statusFilter === "ACTIVE" ? section.isActive : !section.isActive);
      return matchesSearch && matchesYear && matchesGrade && matchesShift && matchesStatus;
    });
  }, [sections, search, yearFilter, gradeFilter, shiftFilter, statusFilter]);

  const hasSetup = academicYears.length > 0 && grades.some((grade) => grade.isActive);

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers className="size-5" />
          </div>
          <div>
            <p className="mt-2 text-sm font-medium text-primary">Academic structure</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Sections</h1>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              Organize each grade into sections by academic year and study shift.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadData()} disabled={loading || saving} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={openCreate} disabled={!hasSetup || saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Plus className="size-4" /> New section
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total sections</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{sections.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Across all academic years</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Active sections</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{activeCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Available for school operations</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Student enrollments</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{enrollmentCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Enrollment records in these sections</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Without a shift</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{unassignedCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Sections not assigned to a study shift</p>
        </div>
      </section>

      {formOpen && (
        <section className="overflow-hidden rounded-xl border border-primary/30 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-primary/[0.035] px-5 py-4">
            <div>
              <h2 className="font-semibold">{editingId ? "Edit section" : "Create section"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Section names and codes must be unique within the selected academic year.
              </p>
            </div>
            <button type="button" aria-label="Close section form" onClick={() => setFormOpen(false)} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={saveSection} className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className={labelClass}>
                <span className={labelTextClass}>Academic year</span>
                <select required value={draft.academicYearId} onChange={(event) => setDraft((old) => ({ ...old, academicYearId: event.target.value }))} className={inputClass}>
                  <option value="">Select academic year</option>
                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " · Current" : ""}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Grade</span>
                <select required value={draft.gradeId} onChange={(event) => setDraft((old) => ({ ...old, gradeId: event.target.value }))} className={inputClass}>
                  <option value="">Select grade</option>
                  {grades.filter((grade) => grade.isActive || grade.id === draft.gradeId).map((grade) => (
                    <option key={grade.id} value={grade.id}>{grade.name} ({grade.code}){!grade.isActive ? " · Inactive" : ""}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Study shift <span className="font-normal text-muted-foreground">(optional)</span></span>
                <select value={draft.studyShiftId} onChange={(event) => setDraft((old) => ({ ...old, studyShiftId: event.target.value }))} className={inputClass}>
                  <option value="">No shift assigned</option>
                  {shifts.filter((shift) => shift.isActive || shift.id === draft.studyShiftId).map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({formatTime(shift.startMinute)}–{formatTime(shift.endMinute)}){!shift.isActive ? " · Inactive" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Section name</span>
                <input required maxLength={100} value={draft.name} onChange={(event) => setDraft((old) => ({ ...old, name: event.target.value }))} placeholder="e.g. Section A" className={inputClass} />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Section code</span>
                <input required maxLength={30} value={draft.code} onChange={(event) => setDraft((old) => ({ ...old, code: event.target.value.toUpperCase() }))} placeholder="e.g. G9-A" className={`${inputClass} uppercase`} />
              </label>
              <label className={labelClass}>
                <span className={labelTextClass}>Student capacity <span className="font-normal text-muted-foreground">(optional)</span></span>
                <input type="number" min={1} step={1} value={draft.capacity} onChange={(event) => setDraft((old) => ({ ...old, capacity: event.target.value }))} placeholder="e.g. 40" className={inputClass} />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setFormOpen(false)} className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
              <button disabled={saving || !hasSetup} type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save section
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-border px-5 py-4 xl:flex-row xl:items-center">
          <div>
            <h2 className="font-semibold">Section directory</h2>
            <p className="mt-1 text-xs text-muted-foreground">Review section assignments and linked academic activity.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <label className="relative sm:col-span-2 xl:col-span-1">
              <span className="sr-only">Search sections</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sections…" className={`${inputClass} pl-9`} />
            </label>
            <select aria-label="Filter by academic year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className={inputClass}>
              <option value="ALL">All academic years</option>
              {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
            <select aria-label="Filter by grade" value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className={inputClass}>
              <option value="ALL">All grades</option>
              {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
            </select>
            <select aria-label="Filter by study shift" value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value)} className={inputClass}>
              <option value="ALL">All shifts</option>
              <option value="NONE">No shift assigned</option>
              {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
            </select>
            <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading sections…
          </div>
        ) : sections.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Layers className="size-5" /></div>
            <h3 className="mt-4 text-base font-semibold">No sections configured</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {hasSetup ? "Create a section to organize students within a grade and academic year." : "Create an academic year and at least one active grade before adding sections."}
            </p>
            {hasSetup && <button type="button" onClick={openCreate} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="size-4" /> Create first section</button>}
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Search className="mx-auto size-6 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No matching sections</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try changing the search term or filters.</p>
            <button type="button" onClick={() => { setSearch(""); setYearFilter("ALL"); setGradeFilter("ALL"); setShiftFilter("ALL"); setStatusFilter("ALL"); }} className="mt-3 text-sm font-medium text-primary hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left">
              <thead className="bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Section</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Academic year</th>
                  <th className="px-4 py-3">Study shift</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Enrollments</th>
                  <th className="px-4 py-3">Subjects</th>
                  <th className="px-4 py-3">Timetable</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSections.map((section) => (
                  <tr key={section.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{section.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{section.code}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium">{section.grade.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Level {section.grade.level}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p>{section.academicYear.name}</p>
                      {section.academicYear.isCurrent && <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Current</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {section.studyShift ? (
                        <>
                          <p>{section.studyShift.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatTime(section.studyShift.startMinute)}–{formatTime(section.studyShift.endMinute)}</p>
                        </>
                      ) : <span className="text-xs text-muted-foreground">Not assigned</span>}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums">{section.capacity ?? "—"}</td>
                    <td className="px-4 py-3.5 tabular-nums">{section._count.enrollments}</td>
                    <td className="px-4 py-3.5 tabular-nums">{section._count.subjectOfferings}</td>
                    <td className="px-4 py-3.5 tabular-nums">{section._count.timetableEntries}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(section.isActive)}`}>
                        {section.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <button type="button" disabled={saving} onClick={() => openEdit(section)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
                          <Pencil className="size-3.5" /> Edit
                        </button>
                        <button type="button" disabled={saving} onClick={() => void toggleActive(section)} className="h-8 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
                          {section.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Showing {filteredSections.length} of {sections.length} sections
        </div>
      </section>

      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Sections belong to an academic year and grade within this school. Study shifts are optional, so a section can be assigned to a morning, afternoon, evening, or weekend schedule. Deactivating a section preserves its enrollment, subject, and timetable history.
        </p>
      </div>
    </div>
  );
}
