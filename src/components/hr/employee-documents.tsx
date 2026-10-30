"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Download,
  Eye,
  X,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";

type DocumentType =
  | "EMPLOYMENT_CONTRACT"
  | "IDENTIFICATION"
  | "EDUCATIONAL_CERTIFICATE"
  | "EXPERIENCE_LETTER"
  | "PROFESSIONAL_CERTIFICATE"
  | "OTHER";

type StaffDocument = {
  id: string;
  documentType: DocumentType;
  title: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  issueDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
};

const categories: { value: DocumentType; label: string }[] = [
  { value: "EMPLOYMENT_CONTRACT", label: "Employment contract" },
  { value: "IDENTIFICATION", label: "Identification" },
  { value: "EDUCATIONAL_CERTIFICATE", label: "Educational certificate" },
  { value: "EXPERIENCE_LETTER", label: "Experience letter" },
  { value: "PROFESSIONAL_CERTIFICATE", label: "Professional certificate" },
  { value: "OTHER", label: "Other" },
];

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function formatSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export function EmployeeDocuments({
  schoolId,
  staffId,
}: {
  schoolId: string;
  staffId: string;
}) {
  const endpoint =
    `/api/schools/${encodeURIComponent(schoolId)}/staff/${encodeURIComponent(staffId)}/documents`;

  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [reviewNoteDrafts, setReviewNoteDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("EMPLOYMENT_CONTRACT");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffDocument | null>(null);
  const [previewDocument, setPreviewDocument] = useState<StaffDocument | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadDocuments = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result?.error === "string" ? result.error : "Unable to load documents.");
      }
      setDocuments(result.documents as StaffDocument[]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to load documents.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    void loadDocuments(controller.signal);
    return () => controller.abort();
  }, [loadDocuments]);

  useEffect(() => {
    if (!previewDocument && !deleteTarget) {
      setPreviewLoading(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (previewDocument) setPreviewDocument(null);
      else if (!busyId) setDeleteTarget(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewDocument, deleteTarget, busyId]);

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setError("");
    setNotice("");

    const body = new FormData();
    body.set("file", file);
    body.set("title", title.trim());
    body.set("documentType", documentType);
    body.set("issueDate", issueDate);
    body.set("expiryDate", expiryDate);
    body.set("notes", notes);

    try {
      const response = await fetch(endpoint, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result?.error === "string" ? result.error : "Upload failed.");
      }
      setDocuments((current) => [
        result.document as StaffDocument,
        ...current,
      ]);
      setTitle("");
      setIssueDate("");
      setExpiryDate("");
      setNotes("");
      setFile(null);
      const input = document.getElementById(`staff-document-file-${staffId}`) as HTMLInputElement | null;
      if (input) input.value = "";
      setNotice("Document uploaded successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function reviewDocument(
    document: StaffDocument,
    status: "APPROVED" | "REJECTED",
  ) {
    if (busyId) return;
    const reviewNotes = (reviewNoteDrafts[document.id] ?? "").trim();

    if (status === "REJECTED" && !reviewNotes) {
      setError("Provide a reason before rejecting a document.");
      return;
    }

    setBusyId(document.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${endpoint}/${encodeURIComponent(document.id)}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            notes: reviewNotes,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Unable to review the document.",
        );
      }

      await loadDocuments();
      setNotice(
        status === "APPROVED"
          ? "Document approved."
          : "Document rejected with feedback.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to review the document.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function deleteDocument(document: StaffDocument) {
    if (busyId) return;
    setBusyId(document.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(document.id)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result?.error === "string" ? result.error : "Delete failed.");
      }
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setDeleteTarget(null);
      setNotice("Document deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete document.");
    } finally {
      setBusyId("");
    }
  }

  function openDocument(document: StaffDocument, preview: boolean) {
    if (preview) {
      setPreviewLoading(true);
      setPreviewDocument(document);
      return;
    }

    window.open(
      `${endpoint}/${encodeURIComponent(document.id)}/download`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="size-5" />
          </div>
          <div>
            <h2 className="font-semibold">Employee documents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contracts, identification, qualifications, and other personnel records.
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-border px-3 py-1 text-xs font-medium">
          {documents.length} {documents.length === 1 ? "document" : "documents"}
        </span>
      </div>

      {error ? (
        <div className="mx-5 mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive sm:mx-6" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mx-5 mt-4 rounded-lg border border-emerald-600/20 bg-emerald-600/5 p-3 text-sm text-emerald-700 dark:text-emerald-300 sm:mx-6" role="status">
          {notice}
        </div>
      ) : null}

      <form onSubmit={uploadDocument} className="space-y-4 border-b border-border bg-muted/20 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Add a document</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Document title *</span>
            <input
              className={inputClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              required
              placeholder="e.g. Signed employment contract"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Category *</span>
            <select
              className={inputClass}
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as DocumentType)}
            >
              {categories.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">File * (max 10 MiB)</span>
            <input
              id={`staff-document-file-${staffId}`}
              className="block min-h-10 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              required
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Issue date</span>
            <input className={inputClass} type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Expiry date</span>
            <input className={inputClass} type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
          </label>

          <label className="block space-y-1.5 sm:col-span-2 xl:col-span-1">
            <span className="text-sm font-medium">Notes</span>
            <input className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} placeholder="Optional details" />
          </label>
        </div>

        {file ? (
          <p className="text-xs text-muted-foreground">
            Selected: {file.name} · {formatSize(file.size)}
          </p>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={uploading || !file || !title.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? "Uploading…" : "Upload document"}
          </button>
        </div>
      </form>

      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Stored documents</h3>
          <button
            type="button"
            onClick={() => void loadDocuments()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading documents…
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">No documents uploaded</p>
            <p className="mt-1 text-sm text-muted-foreground">Add the employee’s first document using the form above.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {documents.map((document) => {
              const category = categories.find((item) => item.value === document.documentType)?.label ?? document.documentType;
              return (
                <article key={document.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="break-words font-medium">{document.title}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{document.originalFileName}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{category}</span>
                        <span>{formatSize(document.sizeBytes)}</span>
                        <span>Added {formatDate(document.createdAt)}</span>
                        {document.expiryDate ? <span>Expires {formatDate(document.expiryDate)}</span> : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Review status:</span>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                            document.reviewStatus === "APPROVED"
                              ? "border-emerald-600/25 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"
                              : document.reviewStatus === "REJECTED"
                                ? "border-destructive/25 bg-destructive/10 text-destructive"
                                : "border-amber-600/25 bg-amber-600/10 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {document.reviewStatus === "APPROVED"
                            ? "Approved"
                            : document.reviewStatus === "REJECTED"
                              ? "Rejected"
                              : "Pending review"}
                        </span>
                        {document.reviewedAt ? (
                          <span className="text-xs text-muted-foreground">
                            Reviewed {formatDate(document.reviewedAt)}
                          </span>
                        ) : null}
                      </div>
                      {document.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{document.notes}</p> : null}
                      {document.reviewNotes ? (
                        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm">
                          <span className="font-medium">Review feedback: </span>
                          {document.reviewNotes}
                        </p>
                      ) : null}
                      <div className="mt-3 max-w-xl space-y-2">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium">Review feedback (required to reject)</span>
                          <textarea
                            className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                            value={reviewNoteDrafts[document.id] ?? ""}
                            onChange={(event) =>
                              setReviewNoteDrafts((current) => ({
                                ...current,
                                [document.id]: event.target.value,
                              }))
                            }
                            maxLength={2000}
                            placeholder="Explain any issue the employee needs to correct"
                            disabled={busyId === document.id}
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={Boolean(busyId)}
                            onClick={() => void reviewDocument(document, "APPROVED")}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-600/30 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-600/5 disabled:opacity-50 dark:text-emerald-300"
                          >
                            {busyId === document.id ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                            Approve document
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(busyId) || !(reviewNoteDrafts[document.id] ?? "").trim()}
                            onClick={() => void reviewDocument(document, "REJECTED")}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
                          >
                            Reject with feedback
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    {document.contentType === "application/pdf" ? (
                      <button type="button" onClick={() => openDocument(document, true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">
                        <Eye className="size-3.5" /> Preview
                      </button>
                    ) : null}
                    <button type="button" onClick={() => openDocument(document, false)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">
                      <Download className="size-3.5" /> Download
                    </button>
                    <button
                      type="button"
                      disabled={busyId === document.id}
                      onClick={() => { setError(""); setDeleteTarget(document); }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
                    >
                      {busyId === document.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {previewDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-2 sm:p-5 lg:p-8"
          onClick={() => setPreviewDocument(null)}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-document-pdf-preview-title"
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
                    id="staff-document-pdf-preview-title"
                    className="truncate text-sm font-semibold"
                  >
                    {previewDocument.originalFileName}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Employee document · PDF preview
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`${endpoint}/${encodeURIComponent(previewDocument.id)}/download`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Download className="size-4" />
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
                  <LoaderCircle className="size-5 animate-spin text-primary" />
                  <span>Opening PDF preview…</span>
                </div>
              )}
              <iframe
                key={previewDocument.id}
                title={`PDF preview: ${previewDocument.originalFileName}`}
                onLoad={() => setPreviewLoading(false)}
                src={`${endpoint}/${encodeURIComponent(previewDocument.id)}/download?view=preview`}
                className="h-full min-h-0 w-full flex-1 border-0 bg-background"
              />
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
              <span className="truncate">
                {previewDocument.title} · {categories.find((item) => item.value === previewDocument.documentType)?.label ?? previewDocument.documentType}
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

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-transparent p-4"
          onClick={() => { if (!busyId) setDeleteTarget(null); }}
          role="presentation"
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="staff-document-delete-title"
            aria-describedby="staff-document-delete-description"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
                  <Trash2 className="size-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id="staff-document-delete-title" className="text-base font-semibold tracking-tight">
                    Delete employee document?
                  </h2>
                  <p id="staff-document-delete-description" className="mt-2 text-sm leading-6 text-muted-foreground">
                    This permanently deletes the selected document from the employee’s records. This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() => setDeleteTarget(null)}
                  aria-label="Close delete confirmation"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 rounded-xl border border-border bg-muted/30 p-3.5">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{deleteTarget.title}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{deleteTarget.originalFileName}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {categories.find((item) => item.value === deleteTarget.documentType)?.label ?? deleteTarget.documentType}
                      {" · "}{formatSize(deleteTarget.sizeBytes)}
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
                disabled={Boolean(busyId)}
                onClick={() => setDeleteTarget(null)}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => { if (deleteTarget && !busyId) void deleteDocument(deleteTarget); }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-white transition hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyId === deleteTarget.id
                  ? <LoaderCircle className="size-4 animate-spin" />
                  : <Trash2 className="size-4" />}
                {busyId === deleteTarget.id ? "Deleting document…" : "Delete permanently"}
              </button>
            </footer>
          </section>
        </div>
      )}

    </section>
  );
}
