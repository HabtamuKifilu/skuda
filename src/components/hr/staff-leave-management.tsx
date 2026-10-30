"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Send,
  X,
  XCircle,
} from "lucide-react";

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

type LeaveRequest = {
  id: string;
  staffProfileId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requestedById: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  staffProfile: Employee;
  requestedBy: { id: string; name: string | null; email: string };
  reviewedBy: { id: string; name: string | null; email: string } | null;
};

const leaveTypes = [
  { value: "ANNUAL", label: "Annual leave" },
  { value: "SICK", label: "Sick leave" },
  { value: "PERSONAL", label: "Personal leave" },
  { value: "MATERNITY", label: "Maternity leave" },
  { value: "PATERNITY", label: "Paternity leave" },
  { value: "UNPAID", label: "Unpaid leave" },
  { value: "OTHER", label: "Other" },
];

const statusLabels: Record<string, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const inputClass =
  "h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function employeeName(employee: Employee) {
  return [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");
}

function statusClass(status: string) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-600/25 bg-emerald-600/10 text-emerald-700";
    case "REJECTED":
      return "border-destructive/25 bg-destructive/5 text-destructive";
    case "CANCELLED":
      return "border-muted-foreground/20 bg-muted text-muted-foreground";
    default:
      return "border-amber-600/25 bg-amber-600/10 text-amber-700";
  }
}

export function StaffLeaveManagement({
  schoolId,
  schoolRole,
  currentUserId,
}: {
  schoolId: string;
  schoolRole: string;
  currentUserId: string;
}) {
  const baseUrl = `/api/schools/${encodeURIComponent(schoolId)}/leave`;
  const isHr = ["OWNER", "ADMIN", "HR_MANAGER"].includes(schoolRole);
  const canReview = ["OWNER", "ADMIN"].includes(schoolRole);

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState("ANNUAL");
  const [startDate, setStartDate] = useState(localToday);
  const [endDate, setEndDate] = useState(localToday);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");
  const [selectedAction, setSelectedAction] = useState<{ item: LeaveRequest; action: "APPROVED" | "REJECTED" | "CANCELLED" } | null>(null);
  const [modalError, setModalError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    setRequests([]);
    if (isHr) setEmployees([]);

    try {
      const response = await fetch(baseUrl, {
        cache: "no-store",
        signal,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Unable to load leave requests.");
      }
      const nextRequests = result.requests as LeaveRequest[];

      if (isHr) {
        const attendanceResponse = await fetch(
          `/api/schools/${encodeURIComponent(schoolId)}/attendance?date=${encodeURIComponent(localToday())}`,
          { cache: "no-store", signal },
        );
        const employeeResult = await attendanceResponse.json();
        if (!attendanceResponse.ok) {
          throw new Error(
            employeeResult?.error || "Unable to load the employee directory.",
          );
        }
        const activeEmployees = (employeeResult.employees as Employee[]).filter(
          (employee) => employee.status === "ACTIVE",
        );
        setEmployees(activeEmployees);
      }

      setRequests(nextRequests);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to load leave requests.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [baseUrl, isHr, schoolId]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((item) => item.status === "PENDING").length,
    approved: requests.filter((item) => item.status === "APPROVED").length,
    rejected: requests.filter((item) => item.status === "REJECTED").length,
  }), [requests]);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((item) => {
      const name = employeeName(item.staffProfile);
      const matchesSearch = !query || [
        name,
        item.staffProfile.employeeNumber,
        item.reason,
        item.leaveType,
      ].some((value) => value.toLowerCase().includes(query));
      return matchesSearch && (filter === "ALL" || item.status === filter);
    });
  }, [requests, search, filter]);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload: Record<string, string> = {
        leaveType,
        startDate,
        endDate,
        reason: reason.trim(),
      };
      if (isHr) {
        if (!employeeId) throw new Error("Select an employee.");
        payload.staffProfileId = employeeId;
      }

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to submit the leave request.");

      setReason("");
      setStartDate(localToday());
      setEndDate(localToday());
      setNotice("Leave request submitted for review.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit the leave request.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewRequest(
    item: LeaveRequest,
    status: "APPROVED" | "REJECTED",
  ) {
    setActionId(item.id);
    setModalError("");
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${baseUrl}/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNotes: reviewNotes[item.id] ?? "",
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Unable to review this request.");
      }

      setSelectedAction(null);
      setModalError("");
      setNotice(`Leave request ${status.toLowerCase()}.`);
      await load();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Unable to review this request.");
    } finally {
      setActionId("");
    }
  }

  async function cancelRequest(item: LeaveRequest) {
    setActionId(item.id);
    setModalError("");
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${baseUrl}/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Unable to cancel this request.");
      }

      setSelectedAction(null);
      setModalError("");
      setNotice("Leave request cancelled.");
      await load();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Unable to cancel this request.");
    } finally {
      setActionId("");
    }
  }

  return (
    <div className="w-full space-y-5 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarDays className="size-4" />
            People &amp; HR / Time &amp; Development
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Staff leave</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submit leave requests, track decisions, and manage employee absences.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || saving || Boolean(actionId)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 font-medium hover:bg-muted disabled:opacity-50"
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
        <div role="status" className="rounded-lg border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm">
          <Check className="mr-2 inline size-4" />{notice}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Requests", value: stats.total, icon: CalendarDays },
          { label: "Pending review", value: stats.pending, icon: Clock3 },
          { label: "Approved", value: stats.approved, icon: CheckCircle2 },
          { label: "Rejected", value: stats.rejected, icon: XCircle },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span>{item.label}</span>
                <Icon className="size-4" />
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submitRequest} className="space-y-4 rounded-xl border bg-card p-4">
        <div>
          <h2 className="font-semibold">New leave request</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Requests are pending until an authorized manager reviews them.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isHr && (
            <label className="flex flex-col gap-1.5 text-xs font-medium xl:col-span-2">
              Employee
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                required
                className={inputClass}
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employeeName(employee)} · {employee.employeeNumber}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-xs font-medium">
            Leave type
            <select
              value={leaveType}
              onChange={(event) => setLeaveType(event.target.value)}
              className={inputClass}
            >
              {leaveTypes.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium">
            End date
            <input
              type="date"
              min={startDate}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium sm:col-span-2 xl:col-span-3">
            Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              maxLength={2000}
              rows={2}
              placeholder="Explain the reason for this leave request…"
              className="min-h-20 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || loading || (isHr && employees.length === 0)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
              {saving ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
        <label className="relative flex-1">
          <span className="mb-1.5 block text-xs font-medium">Search requests</span>
          <Search className="absolute left-3 top-[37px] size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Employee, number, leave type, reason…"
            className={`${inputClass} w-full pl-9`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium sm:w-56">
          Status
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className={inputClass}>
            <option value="ALL">All statuses</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Leave requests</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Showing {visibleRequests.length} of {requests.length} requests.
          </p>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading leave requests…</div>
        ) : visibleRequests.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <CalendarDays className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No leave requests found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New requests will appear here once submitted.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Leave type</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Requested by</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleRequests.map((item) => {
                  const ownRequest = item.requestedById === currentUserId;
                  const canCancel = item.status === "PENDING" && ownRequest;
                  const canAct = canReview &&
                    item.status === "PENDING" &&
                    item.requestedById !== currentUserId;

                  return (
                    <tr key={item.id} className="align-top hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{employeeName(item.staffProfile)}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {item.staffProfile.employeeNumber}
                        </div>
                        {item.staffProfile.jobTitle && (
                          <div className="mt-0.5 text-xs text-muted-foreground">{item.staffProfile.jobTitle}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {leaveTypes.find((type) => type.value === item.leaveType)?.label ?? item.leaveType}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div>{dateLabel(item.startDate)}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">to {dateLabel(item.endDate)}</div>
                      </td>
                      <td className="max-w-64 whitespace-normal px-4 py-3">
                        <p className="line-clamp-3">{item.reason}</p>
                        {item.reviewNotes && (
                          <p className="mt-2 text-xs text-muted-foreground">Review: {item.reviewNotes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                          {statusLabels[item.status] ?? item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>{item.requestedBy.name || item.requestedBy.email}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{dateLabel(item.createdAt)}</div>
                      </td>
                      <td className="min-w-56 px-4 py-3">
                        {canAct && (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={Boolean(actionId)}
                                onClick={() => { setModalError(""); setSelectedAction({ item, action: "APPROVED" }); }}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 font-medium text-primary-foreground disabled:opacity-50"
                              >
                                <Check className="size-3.5" /> Approve
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(actionId)}
                                onClick={() => { setModalError(""); setSelectedAction({ item, action: "REJECTED" }); }}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 font-medium text-destructive disabled:opacity-50"
                              >
                                <XCircle className="size-3.5" /> Reject
                              </button>
                            </div>
                          </div>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            disabled={Boolean(actionId)}
                            onClick={() => { setModalError(""); setSelectedAction({ item, action: "CANCELLED" }); }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 font-medium hover:bg-muted disabled:opacity-50"
                          >
                            <XCircle className="size-3.5" /> Cancel request
                          </button>
                        )}
                        {!canAct && !canCancel && (
                          <span className="text-xs text-muted-foreground">No actions available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selectedAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !actionId) {
              setSelectedAction(null);
              setModalError("");
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-action-title"
            aria-describedby="leave-action-description"
            className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                  selectedAction.action === "APPROVED"
                    ? "bg-emerald-600/10 text-emerald-700"
                    : selectedAction.action === "REJECTED"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-600/10 text-amber-700"
                }`}>
                  {selectedAction.action === "APPROVED" ? (
                    <CheckCircle2 className="size-5" />
                  ) : selectedAction.action === "REJECTED" ? (
                    <XCircle className="size-5" />
                  ) : (
                    <AlertTriangle className="size-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 id="leave-action-title" className="text-base font-semibold tracking-tight">
                    {selectedAction.action === "APPROVED"
                      ? "Approve leave request"
                      : selectedAction.action === "REJECTED"
                        ? "Reject leave request"
                        : "Cancel leave request"}
                  </h2>
                  <p id="leave-action-description" className="mt-1 text-sm leading-5 text-muted-foreground">
                    {selectedAction.action === "APPROVED"
                      ? "Confirm this employee's leave and record your decision."
                      : selectedAction.action === "REJECTED"
                        ? "Record a decision to decline this leave request."
                        : "This will withdraw the pending request from review."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedAction(null); setModalError(""); }}
                disabled={Boolean(actionId)}
                aria-label="Close leave action dialog"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <section className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Employee</p>
                    <p className="mt-1 text-sm font-semibold">
                      {employeeName(selectedAction.item.staffProfile)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selectedAction.item.staffProfile.employeeNumber}
                      {selectedAction.item.staffProfile.jobTitle
                        ? ` · ${selectedAction.item.staffProfile.jobTitle}`
                        : ""}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(selectedAction.item.status)}`}>
                    {statusLabels[selectedAction.item.status] ?? selectedAction.item.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Leave type</p>
                    <p className="mt-1 text-sm font-medium">
                      {leaveTypes.find((type) => type.value === selectedAction.item.leaveType)?.label ?? selectedAction.item.leaveType}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="mt-1 text-sm font-medium">
                      {dateLabel(selectedAction.item.startDate)} – {dateLabel(selectedAction.item.endDate)}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">Reason provided</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5">
                    {selectedAction.item.reason || "No reason provided."}
                  </p>
                </div>
              </section>

              {selectedAction.action !== "CANCELLED" && (
                <div>
                  <label htmlFor="leave-review-note" className="mb-1.5 block text-xs font-medium text-foreground">
                    Review note <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    id="leave-review-note"
                    value={reviewNotes[selectedAction.item.id] ?? ""}
                    onChange={(event) => setReviewNotes((current) => ({
                      ...current,
                      [selectedAction.item.id]: event.target.value,
                    }))}
                    maxLength={2000}
                    rows={3}
                    placeholder="Add context for the employee or future reference..."
                    disabled={Boolean(actionId)}
                    className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-5 outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {(reviewNotes[selectedAction.item.id] ?? "").length}/2000
                  </p>
                </div>
              )}

              {modalError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>{modalError}</p>
                </div>
              )}
            </div>

            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs leading-5 text-muted-foreground">
                {selectedAction.action === "APPROVED"
                  ? "This decision will be recorded in the school audit trail."
                  : selectedAction.action === "REJECTED"
                    ? "The rejection and any note will be recorded for this request."
                    : "Only this pending request will be cancelled."}
              </p>
              <div className="flex shrink-0 justify-end gap-2">
                <button
                  type="button"
                  disabled={Boolean(actionId)}
                  onClick={() => { setSelectedAction(null); setModalError(""); }}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                >
                  Keep request
                </button>
                <button
                  type="button"
                  disabled={Boolean(actionId)}
                  onClick={() => {
                    if (selectedAction.action === "CANCELLED") {
                      void cancelRequest(selectedAction.item);
                    } else {
                      void reviewRequest(selectedAction.item, selectedAction.action);
                    }
                  }}
                  className={`inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none ${
                    selectedAction.action === "APPROVED"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary"
                      : selectedAction.action === "REJECTED"
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"
                        : "border border-destructive/30 bg-background text-destructive hover:bg-destructive/5 focus-visible:ring-destructive"
                  }`}
                >
                  {actionId === selectedAction.item.id ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : selectedAction.action === "APPROVED" ? (
                    <Check className="size-4" />
                  ) : selectedAction.action === "REJECTED" ? (
                    <XCircle className="size-4" />
                  ) : (
                    <AlertTriangle className="size-4" />
                  )}
                  {actionId === selectedAction.item.id
                    ? "Processing..."
                    : selectedAction.action === "APPROVED"
                      ? "Confirm approval"
                      : selectedAction.action === "REJECTED"
                        ? "Confirm rejection"
                        : "Confirm cancellation"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
