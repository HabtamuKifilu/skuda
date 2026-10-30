"use client";

import { RefreshCw, ShieldCheck, UserPlus, X } from "lucide-react";
import { useState } from "react";

type EmployeeCreateDialogProps = {
  open: boolean;
  schoolId: string;
  onClose: () => void;
  onCreated: (name: string) => void;
};

const initialForm = {
  employeeNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  phone: "",
  jobTitle: "",
  department: "",
  hireDate: "",
};

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

const labelClass = "mb-1.5 block text-xs font-medium text-foreground";

export function EmployeeCreateDialog({
  open,
  schoolId,
  onClose,
  onCreated,
}: EmployeeCreateDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  function update(field: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/staff`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeNumber: form.employeeNumber.trim(),
            firstName: form.firstName.trim(),
            middleName: form.middleName.trim() || null,
            lastName: form.lastName.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            jobTitle: form.jobTitle.trim() || null,
            department: form.department.trim() || null,
            hireDate: form.hireDate || null,
          }),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Unable to register this employee. Please try again.",
        );
      }

      const name = [form.firstName.trim(), form.lastName.trim()].join(" ");
      setForm(initialForm);
      onCreated(name);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to register this employee. Please try again.",
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
        aria-labelledby="employee-create-title"
        aria-describedby="employee-create-description"
        className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="size-5" />
            </div>
            <div>
              <h2 id="employee-create-title" className="text-base font-semibold tracking-tight">
                Add employee
              </h2>
              <p id="employee-create-description" className="mt-1 text-sm leading-5 text-muted-foreground">
                Create an employee record for this school. Login access is not created here.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close add employee dialog"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </header>

        <form onSubmit={submit} className="min-h-0 overflow-y-auto">
          <div className="space-y-6 px-5 py-5 sm:px-6">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Employee information</h3>
                <span className="text-xs text-muted-foreground">* Required</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="employee-number" className={labelClass}>
                    Employee number *
                  </label>
                  <input
                    id="employee-number"
                    autoFocus
                    required
                    maxLength={50}
                    value={form.employeeNumber}
                    onChange={(event) => update("employeeNumber", event.target.value)}
                    placeholder="e.g. EMP-001"
                    className={fieldClass}
                    disabled={saving}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Must be unique within this school.
                  </p>
                </div>

                <div>
                  <label htmlFor="employee-first-name" className={labelClass}>
                    First name *
                  </label>
                  <input
                    id="employee-first-name"
                    required
                    maxLength={80}
                    value={form.firstName}
                    onChange={(event) => update("firstName", event.target.value)}
                    placeholder="First name"
                    className={fieldClass}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label htmlFor="employee-middle-name" className={labelClass}>
                    Middle name
                  </label>
                  <input
                    id="employee-middle-name"
                    maxLength={80}
                    value={form.middleName}
                    onChange={(event) => update("middleName", event.target.value)}
                    placeholder="Middle name (optional)"
                    className={fieldClass}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label htmlFor="employee-last-name" className={labelClass}>
                    Last name *
                  </label>
                  <input
                    id="employee-last-name"
                    required
                    maxLength={80}
                    value={form.lastName}
                    onChange={(event) => update("lastName", event.target.value)}
                    placeholder="Last name"
                    className={fieldClass}
                    disabled={saving}
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold">Work and contact details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="employee-job-title" className={labelClass}>
                    Job title
                  </label>
                  <input
                    id="employee-job-title"
                    maxLength={100}
                    value={form.jobTitle}
                    onChange={(event) => update("jobTitle", event.target.value)}
                    placeholder="e.g. Mathematics Teacher"
                    className={fieldClass}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label htmlFor="employee-department" className={labelClass}>
                    Department
                  </label>
                  <input
                    id="employee-department"
                    maxLength={100}
                    value={form.department}
                    onChange={(event) => update("department", event.target.value)}
                    placeholder="e.g. Academics"
                    className={fieldClass}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label htmlFor="employee-hire-date" className={labelClass}>
                    Hire date
                  </label>
                  <input
                    id="employee-hire-date"
                    type="date"
                    value={form.hireDate}
                    onChange={(event) => update("hireDate", event.target.value)}
                    className={fieldClass}
                    disabled={saving}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Optional. Leave blank if the original hire date is unknown.
                  </p>
                </div>

                <div>
                  <label htmlFor="employee-email" className={labelClass}>
                    Email address
                  </label>
                  <input
                    id="employee-email"
                    type="email"
                    maxLength={254}
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    placeholder="name@example.com"
                    className={fieldClass}
                    disabled={saving}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Optional. Does not create a login account.
                  </p>
                </div>

                <div>
                  <label htmlFor="employee-phone" className={labelClass}>
                    Phone number
                  </label>
                  <input
                    id="employee-phone"
                    type="tel"
                    maxLength={100}
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder="Phone number"
                    className={fieldClass}
                    disabled={saving}
                  />
                </div>
              </div>
            </section>

            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-medium">Employee record only</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  This registers the person in the selected school. Passwords, user accounts, and school roles are managed separately by authorized administrators.
                </p>
              </div>
            </div>

            {error ? (
              <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-3">
                <p className="text-sm font-medium text-destructive">Employee could not be added</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
            ) : null}
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <RefreshCw className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              {saving ? "Registering employee…" : "Register employee"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
