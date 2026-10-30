"use client";

import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type StaffProfileFormProps = {
  schoolId: string;
  employeeOnly?: boolean;
};

const staffRoles = [
  { value: "ACADEMIC_HEAD", label: "Academic head" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "TEACHER", label: "Teacher" },
  { value: "REGISTRAR", label: "Registrar" },
  { value: "HR_MANAGER", label: "HR manager" },
];

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50";

export function StaffProfileForm({ schoolId, employeeOnly = false }: StaffProfileFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    employeeNumber: "",
    email: "",
    phone: "",
    jobTitle: "",
    department: "",
    role: "TEACHER",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await fetch(`/api/schools/${schoolId}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          employeeOnly
            ? {
                firstName: form.firstName,
                middleName: form.middleName,
                lastName: form.lastName,
                employeeNumber: form.employeeNumber,
                email: form.email,
                phone: form.phone,
                jobTitle: form.jobTitle,
                department: form.department,
              }
            : form,
        ),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to create the staff member.");
        return;
      }

      setForm({
        firstName: "",
        middleName: "",
        lastName: "",
        employeeNumber: "",
        email: "",
        phone: "",
        jobTitle: "",
        department: "",
        role: "TEACHER",
        password: "",
      });
      setShowPassword(false);
      setSuccess(
        employeeOnly
          ? "Employee record created. No login account or school role was created."
          : "Staff profile and login created. Share the initial password securely.",
      );
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function field(
    id: keyof typeof form,
    label: string,
    options: { required?: boolean; type?: string; autoComplete?: string; placeholder?: string } = {},
  ) {
    return (
      <div className="grid content-start gap-2" key={id}>
        <label htmlFor={`staff-${id}`} className="text-sm font-medium">
          {label}{options.required ? <span className="text-destructive"> *</span> : null}
        </label>
        <input
          id={`staff-${id}`}
          name={id}
          type={options.type ?? "text"}
          autoComplete={options.autoComplete}
          required={options.required}
          maxLength={id === "email" ? 254 : id === "employeeNumber" ? 50 : 100}
          value={form[id]}
          onChange={(event) => update(id, event.target.value)}
          placeholder={options.placeholder}
          disabled={submitting}
          className={inputClass}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {field("firstName", "First name", { required: true, autoComplete: "given-name" })}
        {field("middleName", "Middle name", { autoComplete: "additional-name" })}
        {field("lastName", "Last name", { required: true, autoComplete: "family-name" })}
        {field("employeeNumber", "Employee number", { required: true, placeholder: "e.g. NPS-STAFF-001" })}
        {field("email", employeeOnly ? "Contact email" : "Login email", { required: !employeeOnly, type: "email", autoComplete: "email", placeholder: "staff@example.com" })}
        {field("phone", "Phone number", { type: "tel", autoComplete: "tel" })}
        {field("jobTitle", "Job title", { placeholder: "e.g. Mathematics teacher" })}
        {field("department", "Department", { placeholder: "e.g. Academics" })}

        {!employeeOnly ? (
          <div className="grid content-start gap-2">
            <label htmlFor="staff-role" className="text-sm font-medium">School role <span className="text-destructive">*</span></label>
            <select
              id="staff-role"
              name="role"
              required
              value={form.role}
              onChange={(event) => update("role", event.target.value)}
              disabled={submitting}
              className={inputClass}
            >
              {staffRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </div>
        ) : null}
      </div>

      {!employeeOnly ? (
        <div className="grid max-w-xl gap-2">
          <label htmlFor="staff-password" className="text-sm font-medium">Initial password <span className="text-destructive">*</span></label>
          <div className="relative">
            <input
              id="staff-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
              disabled={submitting}
              className={inputClass + " pr-11"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              disabled={submitting}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">Use a unique temporary password and share it privately. A password-change flow can be added separately.</p>
        </div>
      ) : null}

      {error ? <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
      {success ? <div role="status" className="rounded-lg border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {employeeOnly
            ? "Registers an employee record only. Login access and school roles are managed separately by authorized administrators."
            : "Creates a staff profile, login account, school role, and audit records."}
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
        >
          {submitting ? <><Loader2 className="size-4 animate-spin" />{employeeOnly ? "Registering employee..." : "Creating staff..."}</> : <><UserPlus className="size-4" />{employeeOnly ? "Register employee" : "Create staff member"}</>}
        </button>
      </div>
    </form>
  );
}
