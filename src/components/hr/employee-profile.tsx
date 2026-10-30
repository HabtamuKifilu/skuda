"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { EmployeeEmployment } from "@/components/hr/employee-employment";
import { EmployeeEmploymentHistory } from "@/components/hr/employee-employment-history";
import { EmployeeDocuments } from "@/components/hr/employee-documents";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  Save,
  UserRound,
} from "lucide-react";

type StaffStatus =
  | "ACTIVE"
  | "ON_LEAVE"
  | "SUSPENDED"
  | "TERMINATED"
  | "INACTIVE";

type EmployeeProfile = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  hireDate: string | null;
  jobTitle: string | null;
  department: string | null;
  status: StaffStatus;
  createdAt: string;
  updatedAt: string;
};

type ProfileForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  hireDate: string;
};

const emptyForm: ProfileForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  hireDate: "",
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";

const statusLabels: Record<StaffStatus, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  SUSPENDED: "Suspended",
  TERMINATED: "Terminated",
  INACTIVE: "Inactive",
};

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toForm(staff: EmployeeProfile): ProfileForm {
  return {
    firstName: staff.firstName,
    middleName: staff.middleName ?? "",
    lastName: staff.lastName,
    email: staff.email ?? "",
    phone: staff.phone ?? "",
    dateOfBirth: toDateInput(staff.dateOfBirth),
    gender: staff.gender ?? "",
    hireDate: toDateInput(staff.hireDate),
  };
}

function fullName(staff: EmployeeProfile) {
  return [staff.firstName, staff.middleName, staff.lastName]
    .filter(Boolean)
    .join(" ");
}

function displayDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength,
}: {
  label: string;
  name: keyof ProfileForm;
  value: string;
  onChange: (name: keyof ProfileForm, value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}{required ? " *" : ""}</span>
      <input
        className={inputClass}
        name={name}
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  );
}

export function EmployeeProfile({
  schoolId,
  staffId,
}: {
  schoolId: string;
  staffId: string;
}) {
  const [staff, setStaff] = useState<EmployeeProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);

  const endpoint =
    `/api/schools/${encodeURIComponent(schoolId)}/staff/${encodeURIComponent(staffId)}`;

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Unable to load the employee profile.",
        );
      }

      const employee = result.staff as EmployeeProfile;
      setStaff(employee);
      setForm(toForm(employee));
      setDirty(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the employee profile.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    void loadProfile(controller.signal);
    return () => controller.abort();
  }, [loadProfile]);

  function changeField(name: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setDirty(true);
    setNotice("");
  }

  function discardChanges() {
    if (!staff) return;
    setForm(toForm(staff));
    setDirty(false);
    setError("");
    setNotice("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staff || saving || !dirty) return;

    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      firstName: form.firstName,
      middleName: form.middleName || null,
      lastName: form.lastName,
      email: form.email || null,
      phone: form.phone || null,
      dateOfBirth: form.dateOfBirth || null,
      gender: form.gender || null,
      hireDate: form.hireDate || null,
    };

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Unable to save the employee profile.",
        );
      }

      const updated = result.staff as EmployeeProfile;
      setStaff(updated);
      setForm(toForm(updated));
      setDirty(false);
      setNotice("Employee profile saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the employee profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserRound className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">People &amp; HR</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                {loading ? "Employee profile" : staff ? fullName(staff) : "Employee profile"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Review and update the employee’s personal and work profile.
                Login access and school roles are managed separately.
              </p>
            </div>
          </div>

          {staff ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium">
                {statusLabels[staff.status] ?? staff.status}
              </span>
              <span className="rounded-lg border border-border px-3 py-2 font-mono text-xs">
                {staff.employeeNumber}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4" role="alert">
          <p className="font-medium text-destructive">
            {staff ? "Could not save profile" : "Could not load employee"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          {!staff ? (
            <button
              type="button"
              onClick={() => void loadProfile()}
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <RefreshCw className="size-4" />
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-600/20 bg-emerald-600/5 p-3 text-sm text-emerald-700 dark:text-emerald-300" role="status">
          <CheckCircle2 className="size-4 shrink-0" />
          {notice}
        </div>
      ) : null}

      {loading && !staff ? (
        <div className="rounded-xl border border-border bg-card px-5 py-14 text-center text-sm text-muted-foreground">
          Loading employee profile…
        </div>
      ) : null}

      {!loading && !staff && !error ? (
        <div className="rounded-xl border border-border bg-card px-5 py-14 text-center">
          <p className="font-medium">Employee profile unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This employee may not exist in the selected school.
          </p>
        </div>
      ) : null}

      {staff ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <BriefcaseBusiness className="size-4" />
                <span className="text-sm">Job title</span>
              </div>
              <p className="mt-2 font-semibold">{staff.jobTitle || "Not assigned"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="size-4" />
                <span className="text-sm">Department</span>
              </div>
              <p className="mt-2 font-semibold">{staff.department || "Not assigned"}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="size-4" />
                <span className="text-sm">Hire date</span>
              </div>
              <p className="mt-2 font-semibold">{displayDate(staff.hireDate)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserRound className="size-4" />
                <span className="text-sm">Contact</span>
              </div>
              <p className="mt-2 truncate font-semibold">{staff.email || staff.phone || "Not recorded"}</p>
            </div>
          </section>

          <form onSubmit={saveProfile} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <h2 className="font-semibold">Employee information</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Fields marked with * are required. Employee number and employment status are controlled separately.
              </p>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <section>
                <h3 className="mb-4 text-sm font-semibold">Personal details</h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <Field label="First name" name="firstName" value={form.firstName} onChange={changeField} required maxLength={80} />
                  <Field label="Middle name" name="middleName" value={form.middleName} onChange={changeField} maxLength={80} />
                  <Field label="Last name" name="lastName" value={form.lastName} onChange={changeField} required maxLength={80} />
                  <Field label="Date of birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={changeField} />
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Gender</span>
                    <select
                      className={inputClass}
                      name="gender"
                      value={form.gender}
                      onChange={(event) => changeField("gender", event.target.value)}
                    >
                      <option value="">Not specified</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="border-t border-border pt-6">
                <h3 className="mb-4 text-sm font-semibold">Contact details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Contact email" name="email" type="email" value={form.email} onChange={changeField} maxLength={254} />
                  <Field label="Phone number" name="phone" value={form.phone} onChange={changeField} maxLength={100} />
                </div>
              </section>

              <section className="border-t border-border pt-6">
                <h3 className="mb-4 text-sm font-semibold">Employment details</h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Current job title</span>
                    <input className={inputClass} value={staff.jobTitle || "Not assigned"} readOnly />
                    <span className="block text-xs text-muted-foreground">Changes require an approved job assignment.</span>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Current department</span>
                    <input className={inputClass} value={staff.department || "Not assigned"} readOnly />
                    <span className="block text-xs text-muted-foreground">Changes require an approved job assignment.</span>
                  </label>
                  <Field label="Hire date" name="hireDate" type="date" value={form.hireDate} onChange={changeField} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Use People &amp; HR → Job assignments to request a position change. A future-dated assignment does not change the current position early.
                </p>
              </section>

              <section className="border-t border-border pt-6">
                <h3 className="mb-3 text-sm font-semibold">Administrative fields</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Employee number</span>
                    <input className={inputClass} value={staff.employeeNumber} readOnly />
                    <span className="block text-xs text-muted-foreground">Managed by authorized administration.</span>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Employment status</span>
                    <input className={inputClass} value={statusLabels[staff.status] ?? staff.status} readOnly />
                    <span className="block text-xs text-muted-foreground">Status decisions are handled separately.</span>
                  </label>
                </div>
              </section>
            </div>

            <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs text-muted-foreground">
                Profile changes are recorded in the school audit log.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={discardChanges}
                  disabled={!dirty || saving}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  Discard changes
                </button>
                <button
                  type="submit"
                  disabled={!dirty || saving || loading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                >
                  <Save className={`size-4 ${saving ? "animate-pulse" : ""}`} />
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </form>

          <EmployeeEmployment schoolId={schoolId} staffId={staffId} />
          <EmployeeEmploymentHistory schoolId={schoolId} staffId={staffId} />
          <EmployeeDocuments schoolId={schoolId} staffId={staffId} />
        </>
      ) : null}
    </div>
  );
}
