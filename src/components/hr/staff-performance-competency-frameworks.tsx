"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Plus, RefreshCw, Save, X } from "lucide-react";

type Competency = {
  id?: string;
  name: string;
  description: string;
  rating1Criteria: string;
  rating2Criteria: string;
  rating3Criteria: string;
  rating4Criteria: string;
  rating5Criteria: string;
  sortOrder: number;
  isActive: boolean;
};

type Framework = {
  id: string;
  name: string;
  description: string | null;
  targetJobTitle: string | null;
  targetDepartment: string | null;
  isActive: boolean;
  competencies: Competency[];
};

type Editor = {
  id?: string;
  name: string;
  description: string;
  targetJobTitle: string;
  targetDepartment: string;
  isActive: boolean;
  competencies: Competency[];
};

const blankCompetency = (): Competency => ({
  name: "",
  description: "",
  rating1Criteria: "",
  rating2Criteria: "",
  rating3Criteria: "",
  rating4Criteria: "",
  rating5Criteria: "",
  sortOrder: 0,
  isActive: true,
});

const blankEditor = (): Editor => ({
  name: "",
  description: "",
  targetJobTitle: "",
  targetDepartment: "",
  isActive: true,
  competencies: [blankCompetency()],
});

const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const labelClass = "block text-sm font-medium text-foreground";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50";

  function toEditor(framework: Framework): Editor {
    return {
      id: framework.id,
      name: framework.name,
      description: framework.description ?? "",
      targetJobTitle: framework.targetJobTitle ?? "",
      targetDepartment: framework.targetDepartment ?? "",
      isActive: framework.isActive,
      competencies: framework.competencies.map((item, index) => ({
        ...item,
        description: item.description ?? "",
        sortOrder: index,
      })),
    };
  }


export function StaffPerformanceCompetencyFrameworks({
  schoolId,
}: {
  schoolId: string;
}) {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const endpoint = `/api/schools/${encodeURIComponent(schoolId)}/performance/competency-frameworks`;

  const load = useCallback(async (preferredId?: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to load competency frameworks.");
      }
      if (data.isManager !== true) {
        throw new Error("Manager access is required to configure competency frameworks.");
      }

      const items = (data.frameworks ?? []) as Framework[];
      setFrameworks(items);
      const nextId =
        preferredId && items.some((item) => item.id === preferredId)
          ? preferredId
          : items.some((item) => item.id === selectedId)
            ? selectedId
            : items[0]?.id ?? "";
      setSelectedId(nextId);
      if (!preferredId && !selectedId && items[0]) {
        setEditor(toEditor(items[0]));
      } else if (nextId && nextId !== selectedId) {
        const item = items.find((framework) => framework.id === nextId);
        if (item) setEditor(toEditor(item));
      } else if (!items.length) {
        setEditor(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load frameworks.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, selectedId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);


  function selectFramework(framework: Framework) {
    setSelectedId(framework.id);
    setEditor(toEditor(framework));
    setError("");
    setNotice("");
  }

  function updateEditor<K extends keyof Editor>(key: K, value: Editor[K]) {
    setEditor((current) => current ? { ...current, [key]: value } : current);
  }

  function updateCompetency(index: number, patch: Partial<Competency>) {
    setEditor((current) => current ? {
      ...current,
      competencies: current.competencies.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    } : current);
  }

  function addCompetency() {
    setEditor((current) => {
      if (!current || current.competencies.length >= 50) return current;
      return {
        ...current,
        competencies: [
          ...current.competencies,
          { ...blankCompetency(), sortOrder: current.competencies.length },
        ],
      };
    });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;

    if (!editor.name.trim() || editor.name.trim().length < 2) {
      setError("Enter a framework name with at least two characters.");
      return;
    }
    if (editor.competencies.length < 1 || editor.competencies.length > 50) {
      setError("A framework must contain between 1 and 50 competencies.");
      return;
    }
    for (let index = 0; index < editor.competencies.length; index += 1) {
      const item = editor.competencies[index];
      if (!item.name.trim() || item.name.trim().length < 2) {
        setError(`Competency ${index + 1} needs a name of at least two characters.`);
        return;
      }
      for (let rating = 1; rating <= 5; rating += 1) {
        const value = item[`rating${rating}Criteria` as keyof Competency];
        if (typeof value !== "string" || value.trim().length < 3) {
          setError(`Competency "${item.name}" needs rating ${rating} criteria.`);
          return;
        }
      }
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        name: editor.name.trim(),
        description: editor.description.trim() || null,
        targetJobTitle: editor.targetJobTitle.trim() || null,
        targetDepartment: editor.targetDepartment.trim() || null,
        isActive: editor.isActive,
        competencies: editor.competencies.map((item, index) => ({
          ...(item.id ? { id: item.id } : {}),
          name: item.name.trim(),
          description: item.description.trim() || null,
          rating1Criteria: item.rating1Criteria.trim(),
          rating2Criteria: item.rating2Criteria.trim(),
          rating3Criteria: item.rating3Criteria.trim(),
          rating4Criteria: item.rating4Criteria.trim(),
          rating5Criteria: item.rating5Criteria.trim(),
          sortOrder: index,
          isActive: item.isActive,
        })),
      };

      const response = await fetch(
        editor.id ? `${endpoint}/${encodeURIComponent(editor.id)}` : endpoint,
        {
          method: editor.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to save competency framework.");
      }

      const savedId = editor.id ?? data.framework?.id ?? data.id;
      setNotice("Framework saved successfully.");
      await load(typeof savedId === "string" ? savedId : undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save framework.");
    } finally {
      setSaving(false);
    }
  }

  const visibleFrameworks = frameworks.filter((framework) =>
    `${framework.name} ${framework.description ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-4 md:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            Performance configuration
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Competency frameworks
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Define school-approved competencies and observable rating criteria.
            Reviews retain the criteria snapshots used when the evaluation was recorded.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={secondaryClass} onClick={() => void load(selectedId)} disabled={loading || saving}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={saving}
            onClick={() => {
              setSelectedId("");
              setEditor(blankEditor());
              setError("");
              setNotice("");
            }}
          >
            <Plus className="size-4" /> New framework
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-300/60 bg-red-500/5 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-500/5 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="size-4" /> {notice}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.8fr)]">
        <aside className="min-w-0 space-y-3">
          <label className={labelClass}>
            Find a framework
            <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search frameworks…" />
          </label>
          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {loading && !frameworks.length ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Loading frameworks…
              </div>
            ) : visibleFrameworks.length ? visibleFrameworks.map((framework) => (
              <button
                type="button"
                key={framework.id}
                onClick={() => selectFramework(framework)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === framework.id
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold">{framework.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    framework.isActive ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"
                  }`}>
                    {framework.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {framework.description || "No description provided."}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{framework.competencies.length} competencies</span>
                  {framework.targetJobTitle && <span>· {framework.targetJobTitle}</span>}
                  {framework.targetDepartment && <span>· {framework.targetDepartment}</span>}
                </div>
              </button>
            )) : (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                {search ? "No frameworks match this search." : "No frameworks yet. Create your first framework."}
              </p>
            )}
          </div>
        </aside>

        <form onSubmit={save} className="min-w-0 space-y-5 rounded-xl border border-border p-4 md:p-5">
          {!editor ? (
            <p className="text-sm text-muted-foreground">Choose a framework or create a new one.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h3 className="font-semibold">{editor.id ? "Edit framework" : "New framework"}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {editor.id ? "Changes affect future evaluations, not saved review snapshots." : "Create a reusable competency standard for your school."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editor.isActive} onChange={(event) => updateEditor("isActive", event.target.checked)} />
                    Active
                  </label>
                  <button type="submit" className={buttonClass} disabled={saving}>
                    {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {saving ? "Saving…" : "Save framework"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className={`${labelClass} md:col-span-2`}>
                  Framework name *
                  <input required minLength={2} maxLength={120} className={inputClass} value={editor.name} onChange={(event) => updateEditor("name", event.target.value)} placeholder="e.g. Teaching Excellence" />
                </label>
                <label className={labelClass}>
                  Target job title
                  <input maxLength={120} className={inputClass} value={editor.targetJobTitle} onChange={(event) => updateEditor("targetJobTitle", event.target.value)} placeholder="Blank = all job titles" />
                </label>
                <label className={labelClass}>
                  Target department
                  <input maxLength={120} className={inputClass} value={editor.targetDepartment} onChange={(event) => updateEditor("targetDepartment", event.target.value)} placeholder="Blank = all departments" />
                </label>
                <label className={`${labelClass} md:col-span-2`}>
                  Description
                  <textarea maxLength={2000} rows={3} className={inputClass} value={editor.description} onChange={(event) => updateEditor("description", event.target.value)} placeholder="Purpose, scope and intended outcomes…" />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div>
                  <h4 className="font-semibold">Competency definitions</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Every active competency needs clear criteria for ratings 1–5.
                  </p>
                </div>
                <button type="button" className={secondaryClass} onClick={addCompetency} disabled={saving || editor.competencies.length >= 50}>
                  <Plus className="size-4" /> Add competency
                </button>
              </div>

              {editor.competencies.map((item, index) => (
                <fieldset key={item.id ?? `new-${index}`} className={`min-w-0 space-y-4 rounded-xl border p-4 ${item.isActive ? "border-border" : "border-dashed border-border bg-muted/30 opacity-80"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <legend className="px-1 text-sm font-semibold">
                      Competency {index + 1}{item.id ? " · Saved definition" : " · New definition"}
                    </legend>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={item.isActive} onChange={(event) => updateCompetency(index, { isActive: event.target.checked })} />
                        Active
                      </label>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                        disabled={saving}
                        onClick={() => {
                          if (item.id) {
                            updateCompetency(index, { isActive: false });
                          } else {
                            setEditor((current) => current ? ({
                              ...current,
                              competencies: current.competencies.filter((_, i) => i !== index).map((row, i) => ({ ...row, sortOrder: i })),
                            }) : current);
                          }
                        }}
                        title={item.id ? "Deactivate saved definition" : "Remove unsaved definition"}
                      >
                        <X className="size-3.5" /> {item.id ? "Deactivate" : "Remove"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className={`${labelClass} md:col-span-2`}>
                      Competency name *
                      <input required minLength={2} maxLength={120} className={inputClass} value={item.name} onChange={(event) => updateCompetency(index, { name: event.target.value })} placeholder="e.g. Classroom management" />
                    </label>
                    <label className={`${labelClass} md:col-span-2`}>
                      Description
                      <textarea maxLength={2000} rows={2} className={inputClass} value={item.description} onChange={(event) => updateCompetency(index, { description: event.target.value })} placeholder="Describe the competency and expected behaviours…" />
                    </label>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {[1, 2, 3, 4, 5].map((rating) => {
                      const key = `rating${rating}Criteria` as keyof Competency;
                      const descriptions = ["Needs significant improvement", "Developing", "Meets expectations", "Exceeds expectations", "Outstanding"];
                      return (
                        <label key={rating} className={labelClass}>
                          <span className="flex items-center gap-2">
                            <span className={`inline-flex size-6 items-center justify-center rounded-md text-xs font-bold ${
                              rating <= 2 ? "bg-amber-500/10 text-amber-700" : rating === 3 ? "bg-sky-500/10 text-sky-700" : "bg-emerald-500/10 text-emerald-700"
                            }`}>{rating}</span>
                            Rating {rating} · {descriptions[rating - 1]} *
                          </span>
                          <textarea
                            required
                            minLength={3}
                            maxLength={1000}
                            rows={3}
                            className={inputClass}
                            value={String(item[key] ?? "")}
                            onChange={(event) => updateCompetency(index, { [key]: event.target.value } as Partial<Competency>)}
                            placeholder={`Describe observable evidence for rating ${rating}…`}
                          />
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className="max-w-xl text-xs leading-5 text-muted-foreground">
                  Deactivated definitions remain stored for historical integrity. Review snapshots are not rewritten when a framework changes.
                </p>
                <button type="submit" className={buttonClass} disabled={saving}>
                  {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {saving ? "Saving…" : "Save framework"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
