"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, TrendingUp, Users } from "lucide-react";

type Employee = {
  id: string; employeeNumber: string; firstName: string; middleName: string | null;
  lastName: string; jobTitle: string | null; department: string | null; status: string;
};
type Promotion = {
  id: string; staffProfileId: string; effectiveDate: string;
  previousJobTitle: string | null; newJobTitle: string | null;
  previousDepartment: string | null; newDepartment: string | null;
  description: string | null; createdAt: string;
  staffProfile: { employeeNumber: string; firstName: string; middleName: string | null; lastName: string };
};

const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
const panelClass = "rounded-xl border border-border bg-card p-5";
const buttonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50";

function name(e: Pick<Employee, "firstName" | "middleName" | "lastName">) {
  return [e.firstName, e.middleName, e.lastName].filter(Boolean).join(" ");
}
function dateLabel(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(d);
}

export function StaffPromotionsManagement({ schoolId }: { schoolId: string }) {
  const base = `/api/schools/${encodeURIComponent(schoolId)}/promotions`;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [staffProfileId, setStaffProfileId] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(base, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load promotions.");
      setEmployees(payload.employees ?? []);
      setPromotions(payload.promotions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load promotions.");
    } finally { setLoading(false); }
  }, [base]);

  useEffect(() => {
    const run = async () => {
      await load();
    };

    void run();

  }, [load]);

  const selected = employees.find((employee) => employee.id === staffProfileId);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffProfileId, newJobTitle, newDepartment, effectiveDate, reason,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not record promotion.");
      setNotice("Promotion recorded successfully.");
      setStaffProfileId(""); setNewJobTitle(""); setNewDepartment(""); setReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record promotion.");
    } finally { setSaving(false); }
  };

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="size-4" /> People &amp; HR / Employment</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Promotions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Record employee promotions and preserve employment history.</p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 px-4 py-3 text-sm">{notice}</div>}

      <form onSubmit={submit} className={`${panelClass} space-y-4`}>
        <div>
          <h2 className="font-semibold">Record a promotion</h2>
          <p className="mt-1 text-sm text-muted-foreground">The employee&apos;s current title and department will be updated and the previous values retained in history.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Employee *</span>
            <select required className={inputClass} value={staffProfileId} onChange={(e) => {
              const id = e.target.value; setStaffProfileId(id);
              const employee = employees.find((item) => item.id === id);
              setNewJobTitle(employee?.jobTitle ?? "");
              setNewDepartment(employee?.department ?? "");
            }}>
              <option value="">Select employee</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.employeeNumber} — {name(e)}</option>)}
            </select>
            {selected && <span className="block text-xs text-muted-foreground">Current: {selected.jobTitle || "No title"} · {selected.department || "No department"}</span>}
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">New job title *</span>
            <input required maxLength={150} className={inputClass} value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} placeholder="e.g. Senior Teacher" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">New department</span>
            <input maxLength={150} className={inputClass} value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} placeholder="e.g. Academic Affairs" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Effective date *</span>
            <input required type="date" className={inputClass} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </label>
          <label className="space-y-1.5 text-sm md:col-span-2">
            <span className="font-medium">Reason / justification *</span>
            <textarea required minLength={3} maxLength={1000} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Record the reason for this promotion." />
          </label>
        </div>
        <div className="flex justify-end">
          <button type="submit" className={buttonClass} disabled={saving || loading || !employees.length}>
            <TrendingUp className="size-4" /> {saving ? "Recording…" : "Record promotion"}
          </button>
        </div>
      </form>

      <section className={panelClass}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="font-semibold">Promotion history</h2><p className="mt-1 text-sm text-muted-foreground">Latest 200 promotion records for this school.</p></div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" /> {promotions.length}</div>
        </div>
        {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading promotions…</p> :
          promotions.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No promotions have been recorded yet.</p> :
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-3 font-medium">Employee</th><th className="px-3 py-3 font-medium">Previous role</th><th className="px-3 py-3 font-medium">New role</th><th className="px-3 py-3 font-medium">Effective</th><th className="px-3 py-3 font-medium">Reason</th>
              </tr></thead>
              <tbody>{promotions.map((p) => <tr key={p.id} className="border-b border-border/70 last:border-0">
                <td className="px-3 py-3"><div className="font-medium">{name(p.staffProfile)}</div><div className="text-xs text-muted-foreground">{p.staffProfile.employeeNumber}</div></td>
                <td className="px-3 py-3"><div>{p.previousJobTitle || "—"}</div><div className="text-xs text-muted-foreground">{p.previousDepartment || "No department"}</div></td>
                <td className="px-3 py-3"><div className="font-medium">{p.newJobTitle || "—"}</div><div className="text-xs text-muted-foreground">{p.newDepartment || "No department"}</div></td>
                <td className="whitespace-nowrap px-3 py-3">{dateLabel(p.effectiveDate)}</td>
                <td className="max-w-xs whitespace-normal px-3 py-3">{p.description || "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>}
      </section>
    </div>
  );
}
