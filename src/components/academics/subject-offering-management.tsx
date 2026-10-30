"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BookOpen,
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";

type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Grade = { id: string; name: string; code: string };
type Section = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  academicYearId: string;
  academicYear: AcademicYear;
  grade: Grade;
  studyShift: { id: string; name: string; type: string } | null;
};
type Subject = { id: string; name: string; code: string; isActive: boolean };
type Teacher = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  jobTitle: string | null;
};
type Assignment = {
  id: string;
  staffProfileId: string;
  startDate: string;
  endDate: string | null;
  status: "ACTIVE" | "ENDED";
  staffProfile: Teacher;
};
type Offering = {
  id: string;
  sectionId: string;
  subjectId: string;
  isActive: boolean;
  section: Section;
  subject: Subject;
  teacherAssignments: {
    id: string;
    startDate: string;
    staffProfile: Teacher;
  }[];
  _count: { assessments: number; timetableEntries: number; teacherAssignments: number };
};
type Filters = { year: string; grade: string; section: string; subject: string; status: string };

const initialFilters: Filters = {
  year: "ALL",
  grade: "ALL",
  section: "ALL",
  subject: "ALL",
  status: "ALL",
};

function personName(person: Teacher) {
  return [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(" ");
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}

export function SubjectOfferingManagement({ schoolId }: { schoolId: string }) {
  const base = `/api/schools/${encodeURIComponent(schoolId)}`;
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [draftSection, setDraftSection] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
  const [editSection, setEditSection] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [assignTeacher, setAssignTeacher] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [selectedOffering, setSelectedOffering] = useState<string | null>(null);
  const [historyOffering, setHistoryOffering] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const paths = [
        `${base}/subject-offerings`,
        `${base}/sections`,
        `${base}/subjects`,
        `${base}/academic-years`,
        `${base}/teacher-candidates`,
      ];
      const responses = await Promise.all(
        paths.map((url) => fetch(url, { cache: "no-store" })),
      );
      const results = await Promise.all(responses.map((response) => response.json()));
      const failed = responses.findIndex((response) => !response.ok);
      if (failed !== -1) {
        throw new Error(results[failed]?.error || "Unable to load academic data.");
      }
      setOfferings(results[0].offerings as Offering[]);
      setSections(results[1].sections as Section[]);
      setSubjects(results[2].subjects as Subject[]);
      setYears(results[3].academicYears as AcademicYear[]);
      setTeachers(results[4].candidates as Teacher[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load subject offerings.");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeSections = useMemo(() => sections.filter((section) => section.isActive), [sections]);
  const activeSubjects = useMemo(() => subjects.filter((subject) => subject.isActive), [subjects]);
  const grades = useMemo(() => {
    const unique = new Map<string, Grade>();
    sections.forEach((section) => unique.set(section.grade.id, section.grade));
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sections]);

  const filteredOfferings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return offerings.filter((offering) => {
      const matchesSearch =
        !query ||
        offering.subject.name.toLowerCase().includes(query) ||
        offering.subject.code.toLowerCase().includes(query) ||
        offering.section.name.toLowerCase().includes(query) ||
        offering.section.code.toLowerCase().includes(query) ||
        offering.section.grade.name.toLowerCase().includes(query) ||
        offering.teacherAssignments.some((assignment) =>
          personName(assignment.staffProfile).toLowerCase().includes(query),
        );
      const matchesYear = filters.year === "ALL" || offering.section.academicYear.id === filters.year;
      const matchesGrade = filters.grade === "ALL" || offering.section.grade.id === filters.grade;
      const matchesSection = filters.section === "ALL" || offering.section.id === filters.section;
      const matchesSubject = filters.subject === "ALL" || offering.subject.id === filters.subject;
      const matchesStatus =
        filters.status === "ALL" ||
        (filters.status === "ACTIVE" && offering.isActive) ||
        (filters.status === "INACTIVE" && !offering.isActive);
      return matchesSearch && matchesYear && matchesGrade && matchesSection && matchesSubject && matchesStatus;
    });
  }, [offerings, filters, search]);

  const activeCount = offerings.filter((offering) => offering.isActive).length;
  const assignedCount = offerings.filter(
    (offering) => offering.isActive && offering.teacherAssignments.length > 0,
  ).length;
  const unassignedCount = offerings.filter(
    (offering) => offering.isActive && offering.teacherAssignments.length === 0,
  ).length;

  async function createOffering(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${base}/subject-offerings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: draftSection, subjectId: draftSubject }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create offering.");
      setCreateOpen(false);
      setDraftSection("");
      setDraftSubject("");
      setNotice("Subject offering created.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create offering.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(offering: Offering) {
    setEditingOfferingId(offering.id);
    setEditSection(offering.sectionId);
    setEditSubject(offering.subjectId);
    setCreateOpen(false);
    setSelectedOffering(null);
    setHistoryOffering(null);
    setError("");
    setNotice("");
  }

  async function updateOffering(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingOfferingId) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        base + "/subject-offerings/" + encodeURIComponent(editingOfferingId),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId: editSection,
            subjectId: editSubject,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update subject offering.");
      }

      setEditingOfferingId(null);
      setNotice("Subject offering updated successfully.");
      await loadData();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update subject offering.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleOffering(offering: Offering) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${base}/subject-offerings/${encodeURIComponent(offering.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !offering.isActive }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update offering.");
      setNotice(offering.isActive ? "Subject offering deactivated." : "Subject offering activated.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update offering.");
    } finally {
      setSaving(false);
    }
  }

  async function openAssignmentPanel(offeringId: string) {
    setSelectedOffering(offeringId);
    setHistoryOffering(null);
    setError("");
    setNotice("");
    setAssignments([]);
    setAssignTeacher("");
    try {
      const response = await fetch(
        `${base}/subject-offerings/${encodeURIComponent(offeringId)}/teacher-assignments`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load teacher assignments.");
      setAssignments(result.assignments as Assignment[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load teacher assignments.");
    }
  }

  async function refreshAssignments(offeringId: string) {
    const response = await fetch(
      `${base}/subject-offerings/${encodeURIComponent(offeringId)}/teacher-assignments`,
      { cache: "no-store" },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to refresh teacher assignments.");
    setAssignments(result.assignments as Assignment[]);
    await loadData();
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOffering) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${base}/subject-offerings/${encodeURIComponent(selectedOffering)}/teacher-assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ staffProfileId: assignTeacher, startDate: assignStartDate }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to assign teacher.");
      setNotice("Teacher assigned to subject offering.");
      await refreshAssignments(selectedOffering);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to assign teacher.");
    } finally {
      setSaving(false);
    }
  }

  async function endAssignment(assignment: Assignment) {
    if (!selectedOffering) return;
    if (!window.confirm(`End ${personName(assignment.staffProfile)}'s assignment? The assignment history will be preserved.`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${base}/subject-offerings/${encodeURIComponent(selectedOffering)}/teacher-assignments/${encodeURIComponent(assignment.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endDate: new Date().toISOString().slice(0, 10) }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to end teacher assignment.");
      setNotice("Teacher assignment ended; history preserved.");
      await refreshAssignments(selectedOffering);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to end teacher assignment.");
    } finally {
      setSaving(false);
    }
  }

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const inputClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
  const selected = offerings.find((offering) => offering.id === selectedOffering);

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="size-5" />
          </div>
          <div>
            <p className="mt-2 text-sm font-medium text-primary">Academic structure</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Subject offerings</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Configure which subjects are taught in each section and manage teacher assignments.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadData()} disabled={loading || saving} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={() => { setCreateOpen((value) => !value); setError(""); setNotice(""); }} disabled={saving || activeSections.length === 0 || activeSubjects.length === 0} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Plus className="size-4" /> New offering
          </button>
        </div>
      </section>

      {(error || notice) && (
        <div role={error ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-xl border p-3.5 ${error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400"}`}>
          {error ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0" />}
          <p className="min-w-0 flex-1 text-sm">{error || notice}</p>
          <button type="button" aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}><X className="size-4" /></button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total offerings", value: offerings.length, detail: "Configured section-subject records" },
          { label: "Active offerings", value: activeCount, detail: "Currently available for teaching" },
          { label: "With a teacher", value: assignedCount, detail: "Active offerings with an assignment" },
          { label: "Needs a teacher", value: unassignedCount, detail: "Active offerings without an assignment" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </section>

      {createOpen && (
        <section className="overflow-hidden rounded-xl border border-primary/30 bg-card shadow-sm">
          <div className="border-b border-border bg-primary/[0.035] px-5 py-4">
            <h2 className="font-semibold">Create subject offering</h2>
            <p className="mt-1 text-xs text-muted-foreground">Choose an active section and an active subject in this school.</p>
          </div>
          <form onSubmit={createOffering} className="grid gap-4 p-5 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Section</span>
              <select className={inputClass} value={draftSection} onChange={(event) => setDraftSection(event.target.value)} required>
                <option value="">Select section</option>
                {activeSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.academicYear.name} · {section.grade.name} · {section.name} ({section.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Subject</span>
              <select className={inputClass} value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} required>
                <option value="">Select subject</option>
                {activeSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>)}
              </select>
            </label>
            <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving && <LoaderCircle className="size-4 animate-spin" />} Create offering
              </button>
            </div>
          </form>
        </section>
      )}

      {editingOfferingId && (
        <section className="overflow-hidden rounded-xl border border-primary/30 bg-card shadow-sm">
          <div className="border-b border-border bg-primary/[0.035] px-5 py-4">
            <h2 className="font-semibold">Edit subject offering</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Change the section or subject for this offering. Existing academic records and assignment history are protected.
            </p>
          </div>
          <form onSubmit={updateOffering} className="grid gap-4 p-5 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Section</span>
              <select
                className={inputClass}
                value={editSection}
                onChange={(event) => setEditSection(event.target.value)}
                required
              >
                <option value="">Select section</option>
                {activeSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.academicYear.name} · {section.grade.name} · {section.name} ({section.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Subject</span>
              <select
                className={inputClass}
                value={editSubject}
                onChange={(event) => setEditSubject(event.target.value)}
                required
              >
                <option value="">Select subject</option>
                {activeSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditingOfferingId(null)}
                className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !editSection || !editSubject}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                Save changes
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-semibold">Offering directory</h2>
              <p className="mt-1 text-xs text-muted-foreground">Filter by academic structure, subject, and status.</p>
            </div>
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subject, section, teacher…" aria-label="Search offerings" />
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <select aria-label="Filter by academic year" className={inputClass} value={filters.year} onChange={(event) => updateFilter("year", event.target.value)}>
              <option value="ALL">All academic years</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? " · Current" : ""}</option>)}
            </select>
            <select aria-label="Filter by grade" className={inputClass} value={filters.grade} onChange={(event) => updateFilter("grade", event.target.value)}>
              <option value="ALL">All grades</option>
              {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
            </select>
            <select aria-label="Filter by section" className={inputClass} value={filters.section} onChange={(event) => updateFilter("section", event.target.value)}>
              <option value="ALL">All sections</option>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.name} · {section.academicYear.name}</option>)}
            </select>
            <select aria-label="Filter by subject" className={inputClass} value={filters.subject} onChange={(event) => updateFilter("subject", event.target.value)}>
              <option value="ALL">All subjects</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
            <select aria-label="Filter by status" className={inputClass} value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading subject offerings…</div>
        ) : filteredOfferings.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><BookOpen className="size-5" /></div>
            <h3 className="mt-4 font-semibold">{offerings.length === 0 ? "No subject offerings yet" : "No matching offerings"}</h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              {offerings.length === 0 ? "Create an offering to connect a subject to a section for an academic year." : "Try changing your search or filters."}
            </p>
            {offerings.length === 0 && <button type="button" onClick={() => setCreateOpen(true)} disabled={!activeSections.length || !activeSubjects.length} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Plus className="size-4" /> New offering</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Subject</th><th className="px-4 py-3">Grade / section</th><th className="px-4 py-3">Academic year</th><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Usage</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOfferings.map((offering) => {
                  const currentTeacher = offering.teacherAssignments[0]?.staffProfile;
                  return (
                    <tr key={offering.id} className="align-middle hover:bg-muted/20">
                      <td className="px-5 py-4"><p className="font-semibold">{offering.subject.name}</p><p className="mt-1 text-xs text-muted-foreground">{offering.subject.code}</p></td>
                      <td className="px-4 py-4"><p className="font-medium">{offering.section.grade.name} · {offering.section.name}</p><p className="mt-1 text-xs text-muted-foreground">{offering.section.code}{offering.section.studyShift ? ` · ${offering.section.studyShift.name}` : ""}</p></td>
                      <td className="px-4 py-4"><p>{offering.section.academicYear.name}</p>{offering.section.academicYear.isCurrent && <span className="mt-1 inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Current year</span>}</td>
                      <td className="px-4 py-4">{currentTeacher ? <><p className="font-medium">{personName(currentTeacher)}</p><p className="mt-1 text-xs text-muted-foreground">{currentTeacher.employeeNumber}</p></> : <span className="text-sm text-muted-foreground">Not assigned</span>}</td>
                      <td className="px-4 py-4"><p>{offering._count.assessments} assessments</p><p className="mt-1 text-xs text-muted-foreground">{offering._count.timetableEntries} timetable entries</p></td>
                      <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${offering.isActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${offering.isActive ? "bg-emerald-500" : "bg-muted-foreground"}`} />{offering.isActive ? "Active" : "Inactive"}</span></td>
                      <td className="px-5 py-4"><div className="flex justify-end gap-1.5">
                        <button type="button" disabled={saving || offering._count.teacherAssignments > 0 || offering._count.assessments > 0 || offering._count.timetableEntries > 0} onClick={() => startEditing(offering)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50" title={offering._count.teacherAssignments > 0 || offering._count.assessments > 0 || offering._count.timetableEntries > 0 ? "Editing is unavailable because this offering has academic records or teacher-assignment history" : "Edit section or subject"}><Pencil className="size-3.5" /> Edit</button>
                        <button type="button" disabled={saving || !offering.isActive} onClick={() => void openAssignmentPanel(offering.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50" title="Manage teacher assignments"><Users className="size-3.5" /> Teachers</button>
                        <button type="button" disabled={saving} onClick={() => void toggleOffering(offering)} className="h-8 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50">{offering.isActive ? "Deactivate" : "Activate"}</button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex flex-col gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>Showing {filteredOfferings.length} of {offerings.length} offerings</span>
              <span>Deactivation preserves existing academic records and offering history.</span>
            </div>
          </div>
        )}
      </section>

      {selected && (
        <section className="overflow-hidden rounded-xl border border-primary/25 bg-card shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-border bg-primary/[0.035] px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Teacher assignments</p>
              <h2 className="mt-1 font-semibold">{selected.subject.name} · {selected.section.grade.name} / {selected.section.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">Assignment changes retain the full history for this offering.</p>
            </div>
            <button type="button" onClick={() => { setSelectedOffering(null); setAssignments([]); }} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"><X className="size-4" /> Close</button>
          </div>
          <form onSubmit={createAssignment} className="grid gap-3 border-b border-border p-5 md:grid-cols-[minmax(0,1fr)_190px_auto] md:items-end">
            <label className="space-y-1.5"><span className="text-sm font-medium">Eligible teacher</span>
              <select className={inputClass} value={assignTeacher} onChange={(event) => setAssignTeacher(event.target.value)} required>
                <option value="">Select teacher</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{personName(teacher)} · {teacher.employeeNumber}</option>)}
              </select>
              {teachers.length === 0 && <p className="text-xs text-muted-foreground">No eligible teachers found. Staff need an active teacher membership and linked user account.</p>}
            </label>
            <label className="space-y-1.5"><span className="text-sm font-medium">Start date</span><input type="date" className={inputClass} value={assignStartDate} onChange={(event) => setAssignStartDate(event.target.value)} required /></label>
            <button type="submit" disabled={saving || !teachers.length || !assignTeacher} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Plus className="size-4" /> Assign teacher</button>
          </form>
          <div className="p-5">
            <div className="mb-3 flex items-center gap-2"><Clock3 className="size-4 text-muted-foreground" /><h3 className="font-semibold">Assignment history</h3></div>
            {assignments.length === 0 ? <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No teacher assignments recorded for this offering.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-3 pr-4">Teacher</th><th className="px-4 py-3">Start date</th><th className="px-4 py-3">End date</th><th className="px-4 py-3">Status</th><th className="py-3 pl-4 text-right">Action</th></tr></thead>
                  <tbody className="divide-y divide-border">{assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td className="py-3 pr-4"><p className="font-medium">{personName(assignment.staffProfile)}</p><p className="mt-1 text-xs text-muted-foreground">{assignment.staffProfile.employeeNumber}</p></td>
                      <td className="px-4 py-3">{dateLabel(assignment.startDate)}</td><td className="px-4 py-3">{dateLabel(assignment.endDate)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${assignment.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>{assignment.status === "ACTIVE" ? "Active" : "Ended"}</span></td>
                      <td className="py-3 pl-4 text-right">{assignment.status === "ACTIVE" ? <button type="button" disabled={saving} onClick={() => void endAssignment(assignment)} className="h-8 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50">End assignment</button> : <span className="text-xs text-muted-foreground">History retained</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
