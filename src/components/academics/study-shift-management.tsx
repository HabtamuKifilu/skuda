"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";

const days = [
  { value: "MONDAY", label: "Mon" },
  { value: "TUESDAY", label: "Tue" },
  { value: "WEDNESDAY", label: "Wed" },
  { value: "THURSDAY", label: "Thu" },
  { value: "FRIDAY", label: "Fri" },
  { value: "SATURDAY", label: "Sat" },
  { value: "SUNDAY", label: "Sun" },
] as const;

type ShiftType = "MORNING" | "AFTERNOON" | "EVENING" | "WEEKEND";

const shiftTypes: { value: ShiftType; label: string }[] = [
  { value: "MORNING", label: "Morning shift" },
  { value: "AFTERNOON", label: "Afternoon shift" },
  { value: "EVENING", label: "Evening shift" },
  { value: "WEEKEND", label: "Weekend shift" },
];

type Shift = {
  id: string;
  name: string;
  code: string;
  type: ShiftType;
  description: string | null;
  startMinute: number;
  endMinute: number;
  operatingDays: string[];
  isActive: boolean;
  _count: { sections: number };
};

type Draft = {
  type: ShiftType;
  description: string;
  startTime: string;
  endTime: string;
  endsAtMidnight: boolean;
  operatingDays: string[];
};

const emptyDraft: Draft = {
  type: "MORNING",
  description: "",
  startTime: "08:00",
  endTime: "12:00",
  endsAtMidnight: false,
  operatingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
};

function toTime(minutes: number) {
  if (minutes === 1440) return "00:00";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number) {
  if (minutes === 1440) return "12:00 AM";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${String(hours % 12 || 12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function formatDays(values: string[]) {
  return days.filter((day) => values.includes(day.value)).map((day) => day.label).join(", ");
}

export function StudyShiftManagement({ schoolId }: { schoolId: string }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const endpoint = `/api/schools/${encodeURIComponent(schoolId)}/study-shifts`;

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load study shifts.");
      setShifts(result.shifts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load study shifts.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void loadShifts();
  }, [loadShifts]);

  function openCreate() {
    setDraft(emptyDraft);
    setEditingId(null);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function openEdit(shift: Shift) {
    setDraft({
      type: shift.type,
      description: shift.description ?? "",
      startTime: toTime(shift.startMinute),
      endTime: toTime(shift.endMinute),
      endsAtMidnight: shift.endMinute === 1440,
      operatingDays: shift.operatingDays,
    });
    setEditingId(shift.id);
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function saveShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const startMinute = toMinutes(draft.startTime);
    const endMinute = draft.endsAtMidnight ? 1440 : toMinutes(draft.endTime);

    if (endMinute <= startMinute) {
      setError("End time must be later than start time. Enable “Ends at midnight” for a midnight finish.");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        editingId ? `${endpoint}/${encodeURIComponent(editingId)}` : endpoint,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(!editingId ? { type: draft.type } : {}),
            description: draft.description,
            startMinute,
            endMinute,
            operatingDays: draft.operatingDays,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save study shift.");

      setFormOpen(false);
      setEditingId(null);
      setDraft(emptyDraft);
      setNotice(editingId ? "Study shift updated." : "Study shift created.");
      await loadShifts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save study shift.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(shift: Shift) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(shift.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !shift.isActive }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update shift status.");
      setNotice(shift.isActive ? "Study shift deactivated." : "Study shift activated.");
      await loadShifts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update shift status.");
    } finally {
      setSaving(false);
    }
  }

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const activeCount = shifts.filter((shift) => shift.isActive).length;
  const sectionCount = shifts.reduce((sum, shift) => sum + shift._count.sections, 0);
  const filtered = shifts.filter((shift) =>
    `${shift.name} ${shift.code} ${shift.description ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock3 className="size-5" />
          </div>
          <div>
            <p className="mt-2 text-sm font-medium text-primary">Academic structure</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Study shifts</h1>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              Configure school operating periods and the days each shift runs. Sections can use different shifts within the same grade.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadShifts()} disabled={loading || saving} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" /> New shift
          </button>
        </div>
      </section>

      {(error || notice) && (
        <div role={error ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-xl border p-3.5 ${error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400"}`}>
          {error ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0" />}
          <p className="min-w-0 flex-1 text-sm">{error || notice}</p>
          <button type="button" aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total shifts", value: shifts.length, detail: "Configured operating periods" },
          { label: "Active shifts", value: activeCount, detail: "Available for school operations" },
          { label: "Sections assigned", value: sectionCount, detail: "Sections linked to shifts" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </section>

      {formOpen && (
        <section className="overflow-hidden rounded-xl border border-primary/30 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-primary/[0.035] px-5 py-4">
            <div>
              <h2 className="font-semibold">{editingId ? "Edit study shift" : "Create study shift"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">Shift types are standardized; configure the schedule below.</p>
            </div>
            <button type="button" aria-label="Close shift form" onClick={() => setFormOpen(false)} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
          <form onSubmit={saveShift} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5">
                <span className="block text-xs font-medium">Shift type</span>
                <select
                  required
                  value={draft.type}
                  disabled={Boolean(editingId)}
                  onChange={(event) => updateDraft("type", event.target.value as ShiftType)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {shiftTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {editingId && (
                  <span className="block text-xs text-muted-foreground">
                    Code: {shiftTypes.find((type) => type.value === draft.type)?.value}
                  </span>
                )}
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-medium">Start time</span>
                <input required type="time" value={draft.startTime} onChange={(event) => updateDraft("startTime", event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </label>
              <label className="space-y-1.5">
                <span className="block text-xs font-medium">End time</span>
                <input required type="time" disabled={draft.endsAtMidnight} value={draft.endTime} onChange={(event) => updateDraft("endTime", event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.endsAtMidnight} onChange={(event) => updateDraft("endsAtMidnight", event.target.checked)} className="size-4 rounded border-border accent-primary" />
              Ends at midnight (24:00)
            </label>

            <label className="block max-w-2xl space-y-1.5">
              <span className="block text-xs font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></span>
              <input maxLength={500} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="Additional details about this shift" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </label>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">Operating days</legend>
              <div className="flex flex-wrap gap-2">
                {days.map((day) => {
                  const checked = draft.operatingDays.includes(day.value);
                  return (
                    <label key={day.value} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${checked ? "border-primary/40 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
                      <input type="checkbox" checked={checked} onChange={(event) => updateDraft("operatingDays", event.target.checked ? [...draft.operatingDays, day.value] : draft.operatingDays.filter((value) => value !== day.value))} className="size-3.5 accent-primary" />
                      {day.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setFormOpen(false)} className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">Cancel</button>
              <button disabled={saving || draft.operatingDays.length === 0} type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save shift
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold">Shift directory</h2>
            <p className="mt-1 text-xs text-muted-foreground">Manage operating periods without deleting historical section records.</p>
          </div>
          <label className="relative block w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shifts…" aria-label="Search shifts" className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Loading study shifts…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Clock3 className="size-5" /></div>
            <h3 className="mt-4 text-base font-semibold">{search ? "No matching shifts" : "No study shifts configured"}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{search ? "Try a different name or code." : "Create a shift to define when your school operates."}</p>
            {!search && <button type="button" onClick={openCreate} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="size-4" /> Create first shift</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Shift</th>
                  <th className="px-4 py-3">Operating hours</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Sections</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((shift) => (
                  <tr key={shift.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-5 py-4">
                      <p className="font-medium">{shift.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{shift.code}{shift.description ? ` · ${shift.description}` : ""}</p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm tabular-nums">{formatTime(shift.startMinute)} – {formatTime(shift.endMinute)}</td>
                    <td className="px-4 py-4 text-sm">{formatDays(shift.operatingDays)}</td>
                    <td className="px-4 py-4 text-sm tabular-nums">{shift._count.sections}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${shift.isActive ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {shift.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => openEdit(shift)} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
                          <Pencil className="size-3.5" /> Edit
                        </button>
                        <button type="button" onClick={() => void toggleActive(shift)} disabled={saving} className="h-8 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
                          {shift.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Showing {filtered.length} of {shifts.length} {shifts.length === 1 ? "shift" : "shifts"}
        </div>
      </section>
    </div>
  );
}
