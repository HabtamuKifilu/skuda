"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Save } from "lucide-react";

type EmploymentType =
  | "PERMANENT"
  | "CONTRACT"
  | "TEMPORARY"
  | "PART_TIME"
  | "PROBATION"
  | "INTERN"
  | "VOLUNTEER";

type EmploymentRecord = {
  id: string;
  employmentType: EmploymentType;
  startDate: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractReference: string | null;
  notes: string | null;
};

type EmploymentForm = {
  employmentType: EmploymentType;
  startDate: string;
  contractStartDate: string;
  contractEndDate: string;
  contractReference: string;
  notes: string;
};

const emptyForm: EmploymentForm = {
  employmentType: "PERMANENT",
  startDate: "",
  contractStartDate: "",
  contractEndDate: "",
  contractReference: "",
  notes: "",
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

const employmentTypes: { value: EmploymentType; label: string }[] = [
  { value: "PERMANENT", label: "Permanent" },
  { value: "CONTRACT", label: "Contract" },
  { value: "TEMPORARY", label: "Temporary" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "PROBATION", label: "Probation" },
  { value: "INTERN", label: "Intern" },
  { value: "VOLUNTEER", label: "Volunteer" },
];

function dateValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function formFromRecord(record: EmploymentRecord | null): EmploymentForm {
  if (!record) return { ...emptyForm };

  return {
    employmentType: record.employmentType,
    startDate: dateValue(record.startDate),
    contractStartDate: dateValue(record.contractStartDate),
    contractEndDate: dateValue(record.contractEndDate),
    contractReference: record.contractReference ?? "",
    notes: record.notes ?? "",
  };
}

export function EmployeeEmployment({
  schoolId,
  staffId,
}: {
  schoolId: string;
  staffId: string;
}) {
  const endpoint =
    `/api/schools/${encodeURIComponent(schoolId)}` +
    `/staff/${encodeURIComponent(staffId)}/employment`;

  const [record, setRecord] = useState<EmploymentRecord | null>(null);
  const [form, setForm] = useState<EmploymentForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadEmployment = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");

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
            : "Unable to load employment details.",
        );
      }

      const employment = (result.employment ?? null) as EmploymentRecord | null;
      setRecord(employment);
      setForm(formFromRecord(employment));
      setDirty(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load employment details.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    void loadEmployment(controller.signal);
    return () => controller.abort();
  }, [loadEmployment]);

  function changeField<K extends keyof EmploymentForm>(
    name: K,
    value: EmploymentForm[K],
  ) {
    setForm((current) => ({ ...current, [name]: value }));
    setDirty(true);
    setError("");
    setNotice("");
  }

  function discardChanges() {
    setForm(formFromRecord(record));
    setDirty(false);
    setError("");
    setNotice("");
  }

  async function saveEmployment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !dirty) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employmentType: form.employmentType,
          startDate: form.startDate || null,
          contractStartDate: form.contractStartDate || null,
          contractEndDate: form.contractEndDate || null,
          contractReference: form.contractReference || null,
          notes: form.notes || null,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Unable to save employment details.",
        );
      }

      const employment = result.employment as EmploymentRecord;
      setRecord(employment);
      setForm(formFromRecord(employment));
      setDirty(false);
      setNotice("Employment details saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save employment details.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h2 className="font-semibold">Employment &amp; Contract</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record the employment arrangement and contract dates separately from
          the employee profile and employment status.
        </p>
      </div>

      <form onSubmit={saveEmployment}>
        <div className="space-y-5 p-5 sm:p-6">
          {error ? (
            <div
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
              {!record && !loading ? (
                <button
                  type="button"
                  onClick={() => void loadEmployment()}
                  className="ml-2 font-medium underline"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}

          {notice ? (
            <div
              className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"
              role="status"
            >
              <CheckCircle2 className="size-4 shrink-0" />
              {notice}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Employment type</span>
              <select
                className={inputClass}
                value={form.employmentType}
                disabled={loading || saving}
                onChange={(event) =>
                  changeField(
                    "employmentType",
                    event.target.value as EmploymentType,
                  )
                }
              >
                {employmentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Employment start date</span>
              <input
                className={inputClass}
                type="date"
                value={form.startDate}
                disabled={loading || saving}
                onChange={(event) =>
                  changeField("startDate", event.target.value)
                }
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Contract reference</span>
              <input
                className={inputClass}
                value={form.contractReference}
                maxLength={100}
                disabled={loading || saving}
                placeholder="e.g. HR/CON/2026/001"
                onChange={(event) =>
                  changeField("contractReference", event.target.value)
                }
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Contract start date</span>
              <input
                className={inputClass}
                type="date"
                value={form.contractStartDate}
                disabled={loading || saving}
                onChange={(event) =>
                  changeField("contractStartDate", event.target.value)
                }
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Contract end date</span>
              <input
                className={inputClass}
                type="date"
                min={form.contractStartDate || undefined}
                value={form.contractEndDate}
                disabled={loading || saving}
                onChange={(event) =>
                  changeField("contractEndDate", event.target.value)
                }
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Employment notes</span>
            <textarea
              className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
              value={form.notes}
              maxLength={2000}
              disabled={loading || saving}
              placeholder="Optional employment or contract notes"
              onChange={(event) => changeField("notes", event.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {form.notes.length}/2000 characters
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground">
            Changes are recorded in the school audit log.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={discardChanges}
              disabled={!dirty || saving || loading}
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
              {saving ? "Saving…" : "Save employment details"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
