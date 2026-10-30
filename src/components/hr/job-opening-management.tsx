"use client";

import {
  BriefcaseBusiness,
  Plus,
  RefreshCw,
  Search,
  Globe,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Job = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  employmentType: string;
  status: "DRAFT" | "OPEN" | "ON_HOLD" | "CLOSED" | "CANCELLED";
  isPublished: boolean;
  openingDate: string | null;
  closingDate: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { applications: number };
};

const employmentTypes = [
  "PERMANENT",
  "CONTRACT",
  "TEMPORARY",
  "PART_TIME",
  "PROBATION",
  "INTERN",
  "VOLUNTEER",
] as const;

const statuses = ["DRAFT", "OPEN", "ON_HOLD", "CLOSED", "CANCELLED"] as const;

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not set"
    : new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function dateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function statusClass(status: Job["status"]) {
  if (status === "OPEN") {
    return "border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "CLOSED" || status === "CANCELLED") {
    return "border-border bg-muted text-muted-foreground";
  }
  if (status === "ON_HOLD") {
    return "border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300";
  }
  return "border-indigo-600/20 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300";
}

const emptyForm = {
  title: "",
  department: "",
  description: "",
  employmentType: "PERMANENT",
  status: "DRAFT",
  isPublished: false,
  openingDate: "",
  closingDate: "",
};

type JobForm = typeof emptyForm;

type DocumentType =
  | "CV"
  | "EDUCATIONAL_CERTIFICATE"
  | "EXPERIENCE_LETTER"
  | "APPLICATION_LETTER"
  | "OTHER";

type DocumentRequirement = {
  documentType: DocumentType;
  label: string;
  isRequired: boolean;
  enabled: boolean;
};

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: "CV", label: "Curriculum vitae (CV)" },
  { value: "EDUCATIONAL_CERTIFICATE", label: "Educational certificates" },
  { value: "EXPERIENCE_LETTER", label: "Experience letters" },
  { value: "APPLICATION_LETTER", label: "Application letter" },
  { value: "OTHER", label: "Other documents" },
];

export function JobOpeningManagement({ schoolId }: { schoolId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<JobForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [documentJob, setDocumentJob] = useState<Job | null>(null);
  const [documentRequirements, setDocumentRequirements] = useState<DocumentRequirement[]>([]);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentError, setDocumentError] = useState("");

  const loadJobs = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/job-openings?${params}`,
        { cache: "no-store", signal },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Unable to load vacancies.");
      }
      setJobs(result.jobs as Job[]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to load vacancies.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [schoolId, search]);

  useEffect(() => {
    const controller = new AbortController();
    void loadJobs(controller.signal);
    return () => controller.abort();
  }, [loadJobs]);

  const counts = {
    all: jobs.length,
    open: jobs.filter((job) => job.status === "OPEN").length,
    published: jobs.filter((job) => job.isPublished).length,
    applications: jobs.reduce((sum, job) => sum + job._count.applications, 0),
  };

  function startCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function startEdit(job: Job) {
    setEditing(job.id);
    setForm({
      title: job.title,
      department: job.department ?? "",
      description: job.description ?? "",
      employmentType: job.employmentType,
      status: job.status,
      isPublished: job.isPublished,
      openingDate: dateInput(job.openingDate),
      closingDate: dateInput(job.closingDate),
    });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function change<K extends keyof JobForm>(key: K, value: JobForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...form,
        department: form.department.trim() || null,
        description: form.description.trim() || null,
        openingDate: form.openingDate || null,
        closingDate: form.closingDate || null,
      };
      const url = `/api/schools/${encodeURIComponent(schoolId)}/job-openings${
        editing ? `/${encodeURIComponent(editing)}` : ""
      }`;
      const response = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Unable to save the vacancy.");
      }
      setShowForm(false);
      setNotice(editing ? "Vacancy updated successfully." : "Vacancy created successfully.");
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save the vacancy.");
    } finally {
      setSaving(false);
    }
  }

  async function manageDocuments(job: Job) {
    setDocumentJob(job);
    setDocumentLoading(true);
    setDocumentError("");
    setDocumentRequirements([]);

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/job-openings/${encodeURIComponent(job.id)}/document-requirements`,
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to load document requirements.");
      }

      const existing = Array.isArray(result.requirements)
        ? result.requirements as {
            documentType: DocumentType;
            label: string | null;
            isRequired: boolean;
          }[]
        : [];

      setDocumentRequirements(
        documentTypes.map((type) => {
          const found = existing.find((item) => item.documentType === type.value);
          return {
            documentType: type.value,
            label: found?.label ?? type.label,
            isRequired: found?.isRequired ?? false,
            enabled: Boolean(found),
          };
        }),
      );
    } catch (err) {
      setDocumentError(
        err instanceof Error ? err.message : "Unable to load document requirements.",
      );
    } finally {
      setDocumentLoading(false);
    }
  }

  function changeDocumentRequirement(
    documentType: DocumentType,
    patch: Partial<DocumentRequirement>,
  ) {
    setDocumentRequirements((current) =>
      current.map((item) =>
        item.documentType === documentType ? { ...item, ...patch } : item,
      ),
    );
  }

  async function saveDocumentRequirements() {
    if (!documentJob) return;

    setDocumentSaving(true);
    setDocumentError("");

    try {
      const requirements = documentRequirements
        .filter((item) => item.enabled)
        .map((item) => ({
          documentType: item.documentType,
          label: item.label.trim() || null,
          isRequired: item.isRequired,
        }));

      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/job-openings/${encodeURIComponent(documentJob.id)}/document-requirements`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requirements }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Unable to save document requirements.");
      }

      setNotice(`Document requirements saved for ${documentJob.title}.`);
    } catch (err) {
      setDocumentError(
        err instanceof Error ? err.message : "Unable to save document requirements.",
      );
    } finally {
      setDocumentSaving(false);
    }
  }

  async function setPublication(job: Job, publish: boolean) {
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/job-openings/${encodeURIComponent(job.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublished: publish }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to change publishing.");
      setNotice(publish ? "Vacancy published." : "Vacancy unpublished.");
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change publishing.");
    }
  }

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BriefcaseBusiness className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">People &amp; HR</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Jobs &amp; vacancies
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Create vacancies, manage recruitment status, and control which jobs appear on your public careers page.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void loadJobs()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-4" />
            New vacancy
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {documentJob && (
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Application documents</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {documentJob.title} · Select documents candidates must or may submit.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDocumentJob(null);
                setDocumentRequirements([]);
                setDocumentError("");
              }}
              aria-label="Close document requirements"
              className="rounded-lg p-2 hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>

          {documentError && (
            <div role="alert" className="mx-5 mt-4 rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {documentError}
            </div>
          )}

          {documentLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading document requirements...</p>
          ) : (
            <>
              <div className="divide-y divide-border">
                {documentRequirements.map((item) => (
                  <div key={item.documentType} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-center">
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(event) =>
                          changeDocumentRequirement(item.documentType, {
                            enabled: event.target.checked,
                          })
                        }
                        className="size-4 accent-primary"
                      />
                      {documentTypes.find((type) => type.value === item.documentType)?.label}
                    </label>
                    <input
                      aria-label={`Label for ${item.documentType}`}
                      maxLength={100}
                      value={item.label}
                      disabled={!item.enabled}
                      onChange={(event) =>
                        changeDocumentRequirement(item.documentType, {
                          label: event.target.value,
                        })
                      }
                      className={inputClass}
                      placeholder="Custom document label"
                    />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={item.isRequired}
                        disabled={!item.enabled}
                        onChange={(event) =>
                          changeDocumentRequirement(item.documentType, {
                            isRequired: event.target.checked,
                          })
                        }
                        className="size-4 accent-primary"
                      />
                      Required
                    </label>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
                <button
                  type="button"
                  onClick={() => setDocumentJob(null)}
                  className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={documentSaving || documentLoading}
                  onClick={() => void saveDocumentRequirements()}
                  className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {documentSaving ? "Saving..." : "Save requirements"}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "All vacancies", value: counts.all, detail: "School job records", icon: <BriefcaseBusiness className="size-4" /> },
          { label: "Open", value: counts.open, detail: "Accepting recruitment activity", icon: <Users className="size-4" /> },
          { label: "Publicly published", value: counts.published, detail: "Visible to career seekers", icon: <Globe className="size-4" /> },
          { label: "Applications", value: counts.applications, detail: "Candidates received", icon: <Users className="size-4" /> },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm">{item.label}</span>
              {item.icon}
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{loading ? "—" : item.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </section>

      {showForm && (
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">{editing ? "Edit vacancy" : "Create vacancy"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Public visibility is controlled separately from recruitment status.</p>
            </div>
            <button type="button" onClick={() => setShowForm(false)} aria-label="Close vacancy form" className="rounded-lg p-2 hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={saveJob} className="space-y-4 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="font-medium">Job title *</span>
                <input required maxLength={160} value={form.title} onChange={(e) => change("title", e.target.value)} className={inputClass} placeholder="e.g. Mathematics Teacher" />
              </label>
              <label className="space-y-1.5">
                <span className="font-medium">Department</span>
                <input maxLength={120} value={form.department} onChange={(e) => change("department", e.target.value)} className={inputClass} placeholder="e.g. Academics" />
              </label>
              <label className="space-y-1.5">
                <span className="font-medium">Employment type</span>
                <select value={form.employmentType} onChange={(e) => change("employmentType", e.target.value)} className={inputClass}>
                  {employmentTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="font-medium">Recruitment status</span>
                <select value={form.status} onChange={(e) => {
                  const status = e.target.value;
                  setForm((current) => ({ ...current, status, isPublished: status === "OPEN" ? current.isPublished : false }));
                }} className={inputClass}>
                  {statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="font-medium">Opening date</span>
                <input type="date" value={form.openingDate} onChange={(e) => change("openingDate", e.target.value)} className={inputClass} />
              </label>
              <label className="space-y-1.5">
                <span className="font-medium">Closing date</span>
                <input type="date" min={form.openingDate || undefined} value={form.closingDate} onChange={(e) => change("closingDate", e.target.value)} className={inputClass} />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="font-medium">Job description</span>
              <textarea maxLength={10000} rows={5} value={form.description} onChange={(e) => change("description", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="Responsibilities, qualifications, and application instructions..." />
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-border p-3">
              <input type="checkbox" checked={form.isPublished} disabled={form.status !== "OPEN"} onChange={(e) => change("isPublished", e.target.checked)} className="mt-1 size-4 accent-primary" />
              <span>
                <span className="block font-medium">Publish on the public careers page</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">Only open vacancies can be published. Candidates will not need an account to apply.</span>
              </span>
            </label>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setShowForm(false)} className="h-10 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
              <button type="submit" disabled={saving} className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {saving ? "Saving..." : editing ? "Save changes" : "Create vacancy"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 className="font-semibold">Vacancy records</h2>
          <p className="mt-1 text-sm text-muted-foreground">Search vacancies and manage their status and public visibility.</p>
        </div>
        <div className="relative border-b border-border bg-muted/20 p-4">
          <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Search vacancies" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by job title or department..." className={`${inputClass} pl-9`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Vacancy</th>
                <th className="px-4 py-3 font-medium">Employment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Public listing</th>
                <th className="px-4 py-3 font-medium">Applications</th>
                <th className="px-4 py-3 font-medium">Closing date</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => (
                <tr key={job.id} className="align-middle hover:bg-muted/20">
                  <td className="px-5 py-4">
                    <p className="font-medium">{job.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{job.department || "No department"}</p>
                  </td>
                  <td className="px-4 py-4 text-sm">{label(job.employmentType)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(job.status)}`}>{label(job.status)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${job.isPublished ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
                      <Globe className="size-3.5" /> {job.isPublished ? "Published" : "Private"}
                    </span>
                  </td>
                  <td className="px-4 py-4 tabular-nums">{job._count.applications}</td>
                  <td className="px-4 py-4 text-sm">{dateLabel(job.closingDate)}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void manageDocuments(job)}
                        className="h-8 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted"
                      >
                        Documents
                      </button>
                      <button type="button" onClick={() => startEdit(job)} className="h-8 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted">Edit</button>
                      <button type="button" disabled={job.status !== "OPEN"} onClick={() => void setPublication(job, !job.isPublished)} className="h-8 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
                        {job.isPublished ? "Unpublish" : "Publish"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && jobs.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center">
                  <BriefcaseBusiness className="mx-auto size-8 text-muted-foreground/60" />
                  <p className="mt-3 font-medium">No vacancies found</p>
                  <p className="mt-1 text-sm text-muted-foreground">{search ? "Try another search term." : "Create your first vacancy to begin recruitment."}</p>
                </td></tr>
              )}
              {loading && jobs.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">Loading vacancies...</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Showing {jobs.length} {jobs.length === 1 ? "vacancy" : "vacancies"}
        </div>
      </section>
    </div>
  );
}
