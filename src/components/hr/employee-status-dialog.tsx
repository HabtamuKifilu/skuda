"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  LoaderCircle,
  X,
} from "lucide-react";

type StaffStatus =
  | "ACTIVE"
  | "ON_LEAVE"
  | "SUSPENDED"
  | "TERMINATED"
  | "INACTIVE";

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  status: StaffStatus;
};

const statusLabels: Record<StaffStatus, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  SUSPENDED: "Suspended",
  TERMINATED: "Terminated",
  INACTIVE: "Inactive",
};

const transitions: Record<StaffStatus, StaffStatus[]> = {
  ACTIVE: ["ON_LEAVE", "SUSPENDED", "INACTIVE", "TERMINATED"],
  ON_LEAVE: ["ACTIVE", "SUSPENDED", "INACTIVE", "TERMINATED"],
  SUSPENDED: ["ACTIVE", "ON_LEAVE", "INACTIVE", "TERMINATED"],
  INACTIVE: ["ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"],
  TERMINATED: [],
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

function employeeName(employee: Employee) {
  return [
    employee.firstName,
    employee.middleName,
    employee.lastName,
  ].filter(Boolean).join(" ");
}

export function EmployeeStatusDialog({
  schoolId,
  employee,
  onClose,
  onUpdated,
}: {
  schoolId: string;
  employee: Employee | null;
  onClose: () => void;
  onUpdated: (name: string, status: StaffStatus, message: string) => void;
}) {
  const [nextStatus, setNextStatus] = useState<StaffStatus | "">("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNextStatus(
      employee ? transitions[employee.status][0] ?? "" : "",
    );
    setReason("");
    setError("");
    setSaving(false);
  }, [employee?.id, employee?.status, employee]);

  if (!employee) return null;

  const requiresReason =
    nextStatus === "SUSPENDED" ||
    nextStatus === "INACTIVE" ||
    nextStatus === "TERMINATED";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employee || !nextStatus || saving) return;

    if (requiresReason && reason.trim().length < 3) {
      setError("Provide a reason of at least 3 characters for this change.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/staff/${encodeURIComponent(employee.id)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            reason: reason.trim() || undefined,
          }),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Unable to update the employee status.",
        );
      }

      onUpdated(
        employeeName(employee),
        nextStatus,
        typeof result?.message === "string"
          ? result.message
          : "Employee status updated.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the employee status.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent p-3 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-status-title"
        aria-describedby="employee-status-description"
        className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ArrowRightLeft className="size-5" />
            </div>
            <div>
              <h2 id="employee-status-title" className="text-base font-semibold tracking-tight">
                Manage employee status
              </h2>
              <p id="employee-status-description" className="mt-1 text-sm leading-5 text-muted-foreground">
                Review the proposed change before updating this employee’s record.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close status dialog"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </header>

        <form onSubmit={submit} className="min-h-0 overflow-y-auto">
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="font-semibold">{employeeName(employee)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Employee no. {employee.employeeNumber}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-border bg-background px-2.5 py-1">
                  {statusLabels[employee.status]}
                </span>
                <span className="text-muted-foreground" aria-hidden="true">→</span>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  {nextStatus ? statusLabels[nextStatus] : "No available transition"}
                </span>
              </div>
            </div>

            {transitions[employee.status].length > 0 ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">New status *</span>
                  <select
                    required
                    value={nextStatus}
                    disabled={saving}
                    onChange={(event) => {
                      setNextStatus(event.target.value as StaffStatus);
                      setError("");
                    }}
                    className={inputClass}
                  >
                    {transitions[employee.status].map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">
                    Reason {requiresReason ? "*" : "(optional)"}
                  </span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    rows={3}
                    required={requiresReason}
                    disabled={saving}
                    placeholder={
                      requiresReason
                        ? "Document the reason for this status change…"
                        : "Add context for the audit record, if needed…"
                    }
                    className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                  />
                  <p className="text-xs text-muted-foreground">
                    {reason.length}/500 characters. Sensitive status changes require a reason.
                  </p>
                </label>

                {nextStatus === "TERMINATED" ? (
                  <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <div className="text-sm">
                      <p className="font-medium">Confirm termination carefully</p>
                      <p className="mt-1 leading-5 text-muted-foreground">
                        This permanently terminates the employee record and revokes the linked account’s access to this school. Access to other schools and global login sessions are not changed. The employee record and audit history are retained.
                      </p>
                    </div>
                  </div>
                ) : nextStatus === "SUSPENDED" || nextStatus === "INACTIVE" ? (
                  <div className="flex gap-3 rounded-xl border border-amber-600/20 bg-amber-600/5 p-3.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
                    <p className="text-sm leading-5 text-muted-foreground">
                      This updates the employee’s workforce status only. Account access and school roles are managed separately.
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                Terminated records cannot be reactivated through this workflow. The employee record remains available for historical reference.
              </div>
            )}

            {error ? (
              <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t border-border bg-muted/10 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            {transitions[employee.status].length > 0 ? (
              <button
                type="submit"
                disabled={saving || !nextStatus}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {saving ? "Saving status…" : "Confirm status change"}
              </button>
            ) : null}
          </footer>
        </form>
      </section>
    </div>
  );
}
