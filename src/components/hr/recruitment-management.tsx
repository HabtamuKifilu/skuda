"use client";

import {
  BriefcaseBusiness,
  ClipboardList,
  Eye,
  FileText,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const stages = [
  "RECEIVED",
  "SCREENING",
  "SHORTLISTED",
  "INTERVIEW",
  "OFFERED",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;

type Stage = (typeof stages)[number];

type ApplicationDocument = {
  id: string;
  documentType: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
};

type Application = {
  id: string;
  jobOpeningId: string;
  candidateName: string;
  email: string | null;
  phone: string | null;
  stage: Stage;
  appliedAt: string;
  interviewNotes: string | null;
  decisionNotes: string | null;
  documents: ApplicationDocument[];
  jobOpening: {
    id: string;
    title: string;
    department: string | null;
    status: string;
  };
};

type Job = {
  id: string;
  title: string;
  department: string | null;
  status: string;
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function stageClass(stage: Stage) {
  if (stage === "HIRED") {
    return "border-emerald-600/20 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300";
  }
  if (stage === "REJECTED" || stage === "WITHDRAWN") {
    return "border-border bg-muted text-muted-foreground";
  }
  if (stage === "INTERVIEW" || stage === "OFFERED") {
    return "border-amber-600/20 bg-amber-600/10 text-amber-700 dark:text-amber-300";
  }
  return "border-indigo-600/20 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300";
}

export function RecruitmentManagement({
  schoolId,
}: {
  schoolId: string;
}) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [previewDocument, setPreviewDocument] = useState<ApplicationDocument | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editStage, setEditStage] = useState<Stage>("RECEIVED");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (stageFilter) params.set("stage", stageFilter);
      if (jobFilter) params.set("jobOpeningId", jobFilter);

      const [applicationResponse, jobResponse] = await Promise.all([
        fetch(
          `/api/schools/${encodeURIComponent(schoolId)}/job-applications?${params}`,
          { cache: "no-store", signal },
        ),
        fetch(
          `/api/schools/${encodeURIComponent(schoolId)}/job-openings`,
          { cache: "no-store", signal },
        ),
      ]);

      const [applicationResult, jobResult] = await Promise.all([
        applicationResponse.json(),
        jobResponse.json(),
      ]);

      if (!applicationResponse.ok) {
        throw new Error(applicationResult?.error || "Unable to load applications.");
      }
      if (!jobResponse.ok) {
        throw new Error(jobResult?.error || "Unable to load vacancies.");
      }

      setApplications(applicationResult.applications as Application[]);
      setJobs(jobResult.jobs as Job[]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to load recruitment data.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [schoolId, search, stageFilter, jobFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!previewDocument) {
      setPreviewLoading(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewDocument(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewDocument]);

  const selected = useMemo(
    () => applications.find((application) => application.id === selectedId) ?? null,
    [applications, selectedId],
  );

  function selectApplication(application: Application) {
    setSelectedId(application.id);
    setEditStage(application.stage);
    setInterviewNotes(application.interviewNotes ?? "");
    setDecisionNotes(application.decisionNotes ?? "");
    setError("");
    setNotice("");
  }

  async function saveApplication() {
    if (!selected) return;
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/job-applications/${encodeURIComponent(selected.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stage: editStage,
            interviewNotes,
            decisionNotes,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Unable to save application.");
      }

      const updated = result.application as Application;
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setInterviewNotes(updated.interviewNotes ?? "");
      setDecisionNotes(updated.decisionNotes ?? "");
      setEditStage(updated.stage);
      setNotice("Application updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save application.");
    } finally {
      setSaving(false);
    }
  }

  const counts = {
    total: applications.length,
    screening: applications.filter((item) =>
      ["RECEIVED", "SCREENING"].includes(item.stage),
    ).length,
    interviews: applications.filter((item) => item.stage === "INTERVIEW").length,
    hired: applications.filter((item) => item.stage === "HIRED").length,
  };

  const cardClass = "rounded-xl border border-border bg-card p-4";
  const labelClass = "mb-1.5 block text-xs font-medium text-muted-foreground";

  return (
    <div className="w-full space-y-5 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            People &amp; HR
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Recruitment &amp; applications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review candidates, track hiring stages, and record interview decisions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 font-medium hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

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

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { title: "Applications", value: counts.total, icon: ClipboardList },
          { title: "In review", value: counts.screening, icon: Search },
          { title: "Interviews", value: counts.interviews, icon: Users },
          { title: "Hired", value: counts.hired, icon: BriefcaseBusiness },
        ].map((item) => (
          <div key={item.title} className={cardClass}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{item.title}</p>
              <item.icon className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_200px_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                className={`${inputClass} pl-9`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search candidate, email, vacancy..."
                aria-label="Search applications"
              />
            </div>
            <select
              className={inputClass}
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
              aria-label="Filter by stage"
            >
              <option value="">All stages</option>
              {stages.map((stage) => (
                <option key={stage} value={stage}>{label(stage)}</option>
              ))}
            </select>
            <select
              className={inputClass}
              value={jobFilter}
              onChange={(event) => setJobFilter(event.target.value)}
              aria-label="Filter by vacancy"
            >
              <option value="">All vacancies</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>{job.title}</option>
              ))}
            </select>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {loading ? "Loading applications..." : `${applications.length} application${applications.length === 1 ? "" : "s"} found`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Candidate</th>
                <th className="px-4 py-3 font-medium">Vacancy</th>
                <th className="px-4 py-3 font-medium">Applied</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 text-right font-medium">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!loading && applications.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Users className="mx-auto mb-3 size-7 text-muted-foreground" />
                    <p className="font-medium">No applications found</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Applications will appear here when candidates apply or HR records them.
                    </p>
                  </td>
                </tr>
              )}
              {applications.map((application) => (
                <tr
                  key={application.id}
                  className={`cursor-pointer transition hover:bg-muted/40 ${selectedId === application.id ? "bg-primary/5" : ""}`}
                  onClick={() => selectApplication(application)}
                >
                  <td className="px-4 py-3.5">
                    <p className="font-medium">{application.candidateName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {application.email || application.phone || "No contact details"}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium">{application.jobOpening.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {application.jobOpening.department || "Department not specified"}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {dateLabel(application.appliedAt)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${stageClass(application.stage)}`}>
                      {label(application.stage)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        selectApplication(application);
                      }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Candidate review
              </p>
              <h2 className="mt-1 text-lg font-semibold">{selected.candidateName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.jobOpening.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId("")}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              Close review
            </button>
          </div>

          <div className="border-b border-border p-4">
            <div className="mb-3">
              <h3 className="font-semibold">Supporting documents</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Uploaded files submitted with this application.
              </p>
            </div>
            {(selected.documents ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                No uploaded documents are available for this application.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {(selected.documents ?? []).map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium">
                        {document.originalFileName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {label(document.documentType)} ·{" "}
                        {document.sizeBytes >= 1024 * 1024
                          ? `${(document.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
                          : `${Math.max(1, Math.round(document.sizeBytes / 1024))} KB`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {document.contentType === "application/pdf" && (
                        <button
                          type="button"
                          onClick={() => setPreviewDocument(document)}
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                          <Eye className="size-4" />
                          Preview
                        </button>
                      )}
                      <a
                        href={`/api/schools/${encodeURIComponent(schoolId)}/job-applications/${encodeURIComponent(selected.id)}/documents/${encodeURIComponent(document.id)}/download`}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <FileText className="size-4" />
                        Download
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-5 p-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Hiring stage</label>
                <select
                  className={inputClass}
                  value={editStage}
                  onChange={(event) => setEditStage(event.target.value as Stage)}
                >
                  {stages.map((stage) => (
                    <option key={stage} value={stage}>{label(stage)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Candidate contact</label>
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm">
                  <p>{selected.email || "No email provided"}</p>
                  <p className="mt-1 text-muted-foreground">
                    {selected.phone || "No phone provided"}
                  </p>
                </div>
              </div>
              <div>
                <label className={labelClass}>Interview notes</label>
                <textarea
                  className="min-h-32 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  maxLength={10000}
                  value={interviewNotes}
                  onChange={(event) => setInterviewNotes(event.target.value)}
                  placeholder="Record interview feedback, strengths, concerns, and follow-up..."
                />
              </div>
            </div>
            <div className="flex flex-col">
              <label className={labelClass}>Decision notes</label>
              <textarea
                className="min-h-32 flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                maxLength={10000}
                value={decisionNotes}
                onChange={(event) => setDecisionNotes(event.target.value)}
                placeholder="Record the hiring decision and rationale..."
              />
              <button
                type="button"
                onClick={() => void saveApplication()}
                disabled={saving}
                className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {saving && <RefreshCw className="size-4 animate-spin" />}
                {saving ? "Saving..." : "Save review"}
              </button>
            </div>
          </div>
        </section>
      )}

      {previewDocument && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-2 sm:p-5 lg:p-8"
          onClick={() => setPreviewDocument(null)}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-pdf-preview-title"
            className="flex h-[96dvh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:h-[92dvh]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="application-pdf-preview-title"
                    className="truncate text-sm font-semibold"
                  >
                    {previewDocument.originalFileName}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Candidate document · PDF preview
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`/api/schools/${encodeURIComponent(schoolId)}/job-applications/${encodeURIComponent(selected.id)}/documents/${encodeURIComponent(previewDocument.id)}/download`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <FileText className="size-4" />
                  Download
                </a>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setPreviewDocument(null)}
                  aria-label="Close PDF preview"
                  className="flex size-9 items-center justify-center rounded-lg border border-border transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            <div className="relative flex min-h-0 flex-1 flex-col bg-muted/30">
              {previewLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 text-sm text-muted-foreground">
                  <RefreshCw className="size-5 animate-spin text-primary" />
                  <span>Opening PDF preview…</span>
                </div>
              )}
              <iframe
                key={previewDocument.id}
                title={`PDF preview: ${previewDocument.originalFileName}`}
                onLoad={() => setPreviewLoading(false)}
                src={`/api/schools/${encodeURIComponent(schoolId)}/job-applications/${encodeURIComponent(selected.id)}/documents/${encodeURIComponent(previewDocument.id)}/download?view=preview`}
                className="h-full min-h-0 w-full flex-1 border-0 bg-background"
              />
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
              <span className="truncate">
                {selected.candidateName} · {label(previewDocument.documentType)}
              </span>
              <button
                type="button"
                onClick={() => setPreviewDocument(null)}
                className="shrink-0 rounded-lg px-3 py-2 font-medium text-foreground hover:bg-muted"
              >
                Close preview
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
