"use client";

import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SchoolAdminFormProps = {
  schoolId: string;
};

export function SchoolAdminForm({ schoolId }: SchoolAdminFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/schools/" + schoolId + "/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to create the school administrator.");
        return;
      }

      setName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setSuccess("School administrator created successfully. Share the initial password securely.");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="admin-name" className="text-sm font-medium">Full name</label>
          <input id="admin-name" name="name" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Abebe Kebede" disabled={submitting} className={inputClass} />
        </div>
        <div className="grid gap-2">
          <label htmlFor="admin-email" className="text-sm font-medium">Email address</label>
          <input id="admin-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" disabled={submitting} className={inputClass} />
          <p className="text-xs leading-5 text-muted-foreground">This email will be the administrator login for SKUDA.</p>
        </div>
      </div>

      <div className="grid max-w-xl gap-2">
        <label htmlFor="admin-password" className="text-sm font-medium">Initial password</label>
        <div className="relative">
          <input id="admin-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} className={inputClass + " pr-11"} />
          <button type="button" onClick={() => setShowPassword((current) => !current)} disabled={submitting} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50">
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">Use a unique temporary password and share it privately. A first-login password-change flow is a recommended follow-up.</p>
      </div>

      {error ? <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
      {success ? <div role="status" className="rounded-lg border border-emerald-600/20 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => router.push("/")} disabled={submitting} className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={submitting} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60">
          {submitting ? <><Loader2 className="size-4 animate-spin" />Creating administrator...</> : <><UserPlus className="size-4" />Create school administrator</>}
        </button>
      </div>
    </form>
  );
}
