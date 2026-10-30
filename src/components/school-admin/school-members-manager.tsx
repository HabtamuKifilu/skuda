"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, RefreshCw, UserPlus, Users } from "lucide-react";

type Member = {
  id: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
};

const roles = [
  { value: "ACADEMIC_HEAD", label: "Academic head" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "TEACHER", label: "Teacher" },
  { value: "REGISTRAR", label: "Registrar" },
  { value: "HR_MANAGER", label: "HR manager" },
];

const roleLabels: Record<string, string> = {
  OWNER: "School owner",
  ADMIN: "Administrator",
  ACADEMIC_HEAD: "Academic head",
  ACCOUNTANT: "Accountant",
  TEACHER: "Teacher",
  REGISTRAR: "Registrar",
  HR_MANAGER: "HR manager",
  PARENT: "Parent",
  STUDENT: "Student",
};

type Props = { schoolId: string };

export function SchoolMembersManager({ schoolId }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/schools/${schoolId}/members`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to load school members.");
        return;
      }
      setMembers(Array.isArray(data.memberships) ? data.memberships : []);
    } catch {
      setError("Unable to reach the server while loading members.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/schools/${schoolId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to assign this staff role.");
        return;
      }
      setEmail("");
      setSuccess(`${roleLabels[role]} assigned successfully.`);
      await loadMembers();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <UserPlus className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Assign a staff role</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Assign an existing account that has a matching staff profile in this school.
              </p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 p-6 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
          <div className="grid gap-2">
            <label htmlFor="member-email" className="text-sm font-medium">Account email</label>
            <input id="member-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="staff@example.com" disabled={submitting} className={inputClass} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="member-role" className="text-sm font-medium">School role</label>
            <select id="member-role" name="role" value={role} onChange={(event) => setRole(event.target.value)} disabled={submitting} className={inputClass}>
              {roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <button type="submit" disabled={submitting} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Assign role
          </button>
          {error ? <p role="alert" className="text-sm text-destructive sm:col-span-3">{error}</p> : null}
          {success ? <p role="status" className="text-sm text-emerald-700 sm:col-span-3">{success}</p> : null}
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <Users className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">School members</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {loading ? "Loading membership directory…" : `${members.length} role assignment${members.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => void loadMembers()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading members…</div>
        ) : members.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">No school members found</p>
            <p className="mt-1 text-sm text-muted-foreground">Members will appear here when roles are assigned.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/20">
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{member.user.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{member.user.email}</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{roleLabels[member.role] ?? member.role}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${member.isActive ? "bg-emerald-600/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
