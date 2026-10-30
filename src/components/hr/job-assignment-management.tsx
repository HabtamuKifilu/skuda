"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  History,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  status?: string;
  jobTitle: string | null;
  department: string | null;
};

type StructureItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

type AssignmentRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  effectiveDate: string;
  reason: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  staffProfile: Employee;
  jobTitle: { id: string; name: string; isActive: boolean };
  department: { id: string; name: string; isActive: boolean } | null;
  reportingManager: Employee | null;
  requestedBy: { id: string; name: string | null; email: string };
  reviewedBy: { id: string; name: string | null; email: string } | null;
};

type Assignment = {
  id: string;
  effectiveDate: string;
  endDate: string | null;
  approvalRecordedAt: string | null;
  jobTitle: { id: string; name: string };
  department: { id: string; name: string } | null;
  reportingManager: Employee | null;
  approvedBy: { id: string; name: string | null; email: string } | null;
};

type HistoryResult = {
  employee: Employee;
  currentAssignment: Assignment | null;
  history: Assignment[];
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

const panelClass = "rounded-xl border border-border bg-card p-5";
const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

function employeeName(employee: Employee | null | undefined) {
  if (!employee) return "Not assigned";
  return [
    employee.firstName,
    employee.middleName,
    employee.lastName,
  ].filter(Boolean).join(" ");
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function statusClass(status: string) {
  if (status === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-800";
  if (status === "CANCELLED") return "border-border bg-muted text-muted-foreground";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function JobAssignmentManagement({
  schoolId,
  schoolRole,
  currentUserId,
}: {
  schoolId: string;
  schoolRole: string;
  currentUserId: string;
}) {
  const base = `/api/schools/${encodeURIComponent(schoolId)}`;
  const canManage = schoolRole === "OWNER" || schoolRole === "ADMIN";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobTitles, setJobTitles] = useState<StructureItem[]>([]);
  const [departments, setDepartments] = useState<StructureItem[]>([]);
  const [requests, setRequests] = useState<AssignmentRequest[]>([]);
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [historyStaffId, setHistoryStaffId] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [staffProfileId, setStaffProfileId] = useState("");
  const [jobTitleId, setJobTitleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState("");

  const [structureKind, setStructureKind] = useState<"jobTitle" | "department">("jobTitle");
  const [structureName, setStructureName] = useState("");
  const [structureDescription, setStructureDescription] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const [structureResponse, requestResponse, staffResponse] = await Promise.all([
        fetch(`${base}/job-structure`, { cache: "no-store", signal }),
        fetch(`${base}/job-assignment-requests`, { cache: "no-store", signal }),
        fetch(`${base}/staff?status=ACTIVE&pageSize=100`, { cache: "no-store", signal }),
      ]);

      const [structureData, requestData, staffData] = await Promise.all([
        structureResponse.json(),
        requestResponse.json(),
        staffResponse.json(),
      ]);

      for (const [response, data, fallback] of [
        [structureResponse, structureData, "Unable to load job titles and departments."],
        [requestResponse, requestData, "Unable to load assignment requests."],
        [staffResponse, staffData, "Unable to load active employees."],
      ] as const) {
        if (!response.ok) throw new Error(data?.error || fallback);
      }

      setJobTitles(structureData.jobTitles as StructureItem[]);
      setDepartments(structureData.departments as StructureItem[]);
      setRequests(requestData.requests as AssignmentRequest[]);
      setEmployees(staffData.staff as Employee[]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to load job assignments.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const activeTitles = useMemo(
    () => jobTitles.filter((item) => item.isActive),
    [jobTitles],
  );
  const activeDepartments = useMemo(
    () => departments.filter((item) => item.isActive),
    [departments],
  );

  const visibleRequests = useMemo(
    () => statusFilter === "ALL"
      ? requests
      : requests.filter((item) => item.status === statusFilter),
    [requests, statusFilter],
  );

  const pendingCount = requests.filter((item) => item.status === "PENDING").length;
  const approvedCount = requests.filter((item) => item.status === "APPROVED").length;

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${base}/job-assignment-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffProfileId,
          jobTitleId,
          departmentId: departmentId || null,
          reportingManagerId: reportingManagerId || null,
          effectiveDate,
          reason,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to submit request.");

      setStaffProfileId("");
      setJobTitleId("");
      setDepartmentId("");
      setReportingManagerId("");
      setReason("");
      setNotice("Assignment request submitted for review.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit request.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewRequest(
    item: AssignmentRequest,
    action: "APPROVE" | "REJECT" | "CANCEL",
  ) {
    let reviewNotes = "";
    if (action === "REJECT") {
      const answer = window.prompt("Reason for rejection (optional):");
      if (answer === null) return;
      reviewNotes = answer.trim();
    } else if (action === "CANCEL") {
      if (!window.confirm("Cancel this pending assignment request?")) return;
    } else {
      if (!window.confirm(
        `Approve ${employeeName(item.staffProfile)} for ${item.jobTitle.name}, effective ${dateLabel(item.effectiveDate)}?`,
      )) return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${base}/job-assignment-requests/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, reviewNotes }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to process request.");
      setNotice(
        action === "APPROVE" ? "Assignment approved."
          : action === "REJECT" ? "Assignment request rejected."
            : "Assignment request cancelled.",
      );
      await load();
      if (historyStaffId === item.staffProfile.id) {
        await loadHistory(historyStaffId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process request.");
    } finally {
      setSaving(false);
    }
  }

  async function submitStructureItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${base}/job-structure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: structureKind,
          name: structureName,
          description: structureDescription,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to create item.");
      setStructureName("");
      setStructureDescription("");
      setNotice(structureKind === "jobTitle" ? "Job title created." : "Department created.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create item.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStructureItem(item: StructureItem, kind: "jobTitle" | "department") {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${base}/job-structure`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id: item.id, isActive: !item.isActive }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to update item.");
      setNotice(`${item.name} ${item.isActive ? "deactivated" : "activated"}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update item.");
    } finally {
      setSaving(false);
    }
  }

  async function loadHistory(staffId: string) {
    setHistoryStaffId(staffId);
    setHistory(null);
    if (!staffId) return;

    setError("");
    try {
      const response = await fetch(
        `${base}/staff/${encodeURIComponent(staffId)}/job-assignments`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to load assignment history.");
      setHistory(result as HistoryResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load assignment history.");
    }
  }

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <BriefcaseBusiness className="size-4" />
            People &amp; HR / Employment
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Job assignments</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Manage school job titles, departments, reporting lines, and approved employment-position history.
          </p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading || saving}>
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
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={panelClass}>
          <div className="flex items-center justify-between text-muted-foreground"><span>Total requests</span><ClipboardIcon /></div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{requests.length}</p>
        </div>
        <div className={panelClass}>
          <div className="flex items-center justify-between text-muted-foreground"><span>Awaiting review</span><Clock3 className="size-4" /></div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{pendingCount}</p>
        </div>
        <div className={panelClass}>
          <div className="flex items-center justify-between text-muted-foreground"><span>Approved requests</span><CheckCircle2 className="size-4" /></div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{approvedCount}</p>
        </div>
        <div className={panelClass}>
          <div className="flex items-center justify-between text-muted-foreground"><span>Active employees</span><Users className="size-4" /></div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{employees.length}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className={panelClass}>
          <div className="mb-4">
            <h2 className="text-base font-semibold">Request a position change</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Requests take effect only after approval and on the specified effective date.
            </p>
          </div>
          <form className="space-y-4" onSubmit={submitRequest}>
            <div className="space-y-1.5">
              <label htmlFor="assignment-employee" className="font-medium">Employee *</label>
              <select id="assignment-employee" className={inputClass} required value={staffProfileId} onChange={(event) => setStaffProfileId(event.target.value)} disabled={saving}>
                <option value="">Select an active employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeNumber} — {employeeName(employee)}
                  </option>
                ))}
              </select>
              {staffProfileId && (
                <p className="text-xs text-muted-foreground">
                  Current profile position: {[employees.find((employee) => employee.id === staffProfileId)?.jobTitle, employees.find((employee) => employee.id === staffProfileId)?.department].filter(Boolean).join(" · ") || "Not specified"}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="assignment-title" className="font-medium">Requested job title *</label>
              <select id="assignment-title" className={inputClass} required value={jobTitleId} onChange={(event) => setJobTitleId(event.target.value)} disabled={saving}>
                <option value="">Select a job title</option>
                {activeTitles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {activeTitles.length === 0 && <p className="text-xs text-muted-foreground">Create an active job title below before submitting a request.</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="assignment-department" className="font-medium">Department</label>
                <select id="assignment-department" className={inputClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} disabled={saving}>
                  <option value="">No department</option>
                  {activeDepartments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="assignment-manager" className="font-medium">Reporting manager</label>
                <select id="assignment-manager" className={inputClass} value={reportingManagerId} onChange={(event) => setReportingManagerId(event.target.value)} disabled={saving}>
                  <option value="">No reporting manager</option>
                  {employees.filter((employee) => employee.id !== staffProfileId).map((employee) => (
                    <option key={employee.id} value={employee.id}>{employeeName(employee)} · {employee.employeeNumber}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="assignment-effective-date" className="font-medium">Effective date *</label>
              <input id="assignment-effective-date" type="date" className={inputClass} required value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} disabled={saving} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="assignment-reason" className="font-medium">Business reason *</label>
              <textarea id="assignment-reason" className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the reason for the new position, department, or reporting line." disabled={saving} />
              <p className="text-right text-xs text-muted-foreground">{reason.length}/2000</p>
            </div>

            <button className={buttonClass} type="submit" disabled={saving || !staffProfileId || !jobTitleId || !effectiveDate || !reason.trim()}>
              <Plus className="size-4" /> {saving ? "Processing…" : "Submit for approval"}
            </button>
          </form>
        </section>

        <section className={panelClass}>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold">Assignment requests</h2>
              <p className="mt-1 text-sm text-muted-foreground">Review requested changes and their approval status.</p>
            </div>
            <select aria-label="Filter requests by status" className={`${inputClass} sm:w-44`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground"><RefreshCw className="size-4 animate-spin" /> Loading requests…</div>
          ) : visibleRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No requests match this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRequests.map((item) => {
                const canCancel = item.status === "PENDING" && (canManage || item.requestedBy.id === currentUserId);
                return (
                  <article key={item.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{employeeName(item.staffProfile)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.staffProfile.employeeNumber}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClass(item.status)}`}>{item.status}</span>
                    </div>
                    <div className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                      <div><span className="text-muted-foreground">Position</span><p className="font-medium">{item.jobTitle.name}</p></div>
                      <div><span className="text-muted-foreground">Department</span><p className="font-medium">{item.department?.name ?? "Not assigned"}</p></div>
                      <div><span className="text-muted-foreground">Reporting manager</span><p className="font-medium">{employeeName(item.reportingManager)}</p></div>
                      <div><span className="text-muted-foreground">Effective date</span><p className="font-medium">{dateLabel(item.effectiveDate)}</p></div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.reason}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Requested by {item.requestedBy.name || item.requestedBy.email} · {dateLabel(item.createdAt)}
                    </p>
                    {item.reviewNotes && (
                      <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">Review note: {item.reviewNotes}</p>
                    )}
                    {item.reviewedBy && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Reviewed by {item.reviewedBy.name || item.reviewedBy.email} · {dateLabel(item.reviewedAt)}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className={secondaryButtonClass} onClick={() => void loadHistory(item.staffProfile.id)}>
                        <History className="size-4" /> Employee history
                      </button>
                      {item.status === "PENDING" && canManage && (
                        <>
                          <button type="button" className={buttonClass} disabled={saving} onClick={() => void reviewRequest(item, "APPROVE")}>
                            <CheckCircle2 className="size-4" /> Approve
                          </button>
                          <button type="button" className={secondaryButtonClass} disabled={saving} onClick={() => void reviewRequest(item, "REJECT")}>
                            <XCircle className="size-4" /> Reject
                          </button>
                        </>
                      )}
                      {canCancel && (
                        <button type="button" className={secondaryButtonClass} disabled={saving} onClick={() => void reviewRequest(item, "CANCEL")}>
                          Cancel request
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className={panelClass}>
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2"><History className="size-5" /></div>
          <div>
            <h2 className="text-base font-semibold">Employee assignment history</h2>
            <p className="mt-1 text-sm text-muted-foreground">The current effective assignment is shown separately from scheduled and historical positions.</p>
          </div>
        </div>
        <div className="max-w-xl">
          <label htmlFor="history-employee" className="mb-1.5 block font-medium">Select employee</label>
          <select id="history-employee" className={inputClass} value={historyStaffId} onChange={(event) => void loadHistory(event.target.value)}>
            <option value="">Choose an employee</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} — {employeeName(employee)}</option>)}
          </select>
        </div>

        {history && (
          <div className="mt-5 space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4" /> Current effective position</div>
              {history.currentAssignment ? (
                <>
                  <p className="mt-3 text-lg font-semibold">{history.currentAssignment.jobTitle.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[history.currentAssignment.department?.name, `Effective ${dateLabel(history.currentAssignment.effectiveDate)}`].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-2 text-sm">Reporting manager: {employeeName(history.currentAssignment.reportingManager)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Approved by: {history.currentAssignment.approvedBy?.name || history.currentAssignment.approvedBy?.email || "Approval record unavailable"}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No approved assignment is effective today. The employee profile's legacy position fields are not a substitute for an approved assignment record.</p>
              )}
            </div>

            <h3 className="font-semibold">Assignment timeline ({history.history.length})</h3>
            {history.history.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">No approved assignment history has been recorded for this employee.</p>
            ) : (
              <div className="space-y-2">
                {history.history.map((item) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const effective = item.effectiveDate.slice(0, 10);
                  const end = item.endDate?.slice(0, 10);
                  const isCurrent = effective <= today && (!end || end >= today);
                  const isScheduled = effective > today;
                  return (
                    <div key={item.id} className="flex flex-col justify-between gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{item.jobTitle.name}</p>
                          {isCurrent && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">Current</span>}
                          {isScheduled && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">Scheduled</span>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[item.department?.name, `${dateLabel(item.effectiveDate)} – ${item.endDate ? dateLabel(item.endDate) : "No end date"}`].filter(Boolean).join(" · ")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Manager: {employeeName(item.reportingManager)} · Approved by: {item.approvedBy?.name || item.approvedBy?.email || "Unavailable"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {canManage && (
        <section className={panelClass}>
          <div className="mb-4">
            <h2 className="text-base font-semibold">Job structure</h2>
            <p className="mt-1 text-sm text-muted-foreground">Maintain this school's job titles and departments. Deactivation prevents new requests from using an item but preserves historical records.</p>
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <form className="space-y-3" onSubmit={submitStructureItem}>
              <div className="space-y-1.5">
                <label htmlFor="structure-kind" className="font-medium">Item type</label>
                <select id="structure-kind" className={inputClass} value={structureKind} onChange={(event) => setStructureKind(event.target.value as "jobTitle" | "department")}>
                  <option value="jobTitle">Job title</option>
                  <option value="department">Department</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="structure-name" className="font-medium">Name *</label>
                <input id="structure-name" className={inputClass} maxLength={100} required value={structureName} onChange={(event) => setStructureName(event.target.value)} placeholder={structureKind === "jobTitle" ? "e.g. Mathematics Teacher" : "e.g. Academics"} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="structure-description" className="font-medium">Description</label>
                <textarea id="structure-description" className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" maxLength={1000} value={structureDescription} onChange={(event) => setStructureDescription(event.target.value)} placeholder="Optional description" />
              </div>
              <button type="submit" className={buttonClass} disabled={saving || !structureName.trim()}>
                <Plus className="size-4" /> Create {structureKind === "jobTitle" ? "job title" : "department"}
              </button>
            </form>

            <div className="grid gap-5 md:grid-cols-2">
              <StructureList title="Job titles" items={jobTitles} onToggle={(item) => void toggleStructureItem(item, "jobTitle")} saving={saving} />
              <StructureList title="Departments" items={departments} onToggle={(item) => void toggleStructureItem(item, "department")} saving={saving} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ClipboardIcon() {
  return <BriefcaseBusiness className="size-4" />;
}

function StructureList({
  title,
  items,
  onToggle,
  saving,
}: {
  title: string;
  items: StructureItem[];
  onToggle: (item: StructureItem) => void;
  saving: boolean;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title} ({items.length})</h3>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No items created yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className={`mt-0.5 text-xs ${item.isActive ? "text-emerald-700" : "text-muted-foreground"}`}>{item.isActive ? "Active" : "Inactive"}</p>
              </div>
              <button type="button" className={secondaryButtonClass} disabled={saving} onClick={() => onToggle(item)}>
                {item.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
