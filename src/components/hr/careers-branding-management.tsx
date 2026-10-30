"use client";

import { useEffect, useState } from "react";

type Branding = {
  careersMotto: string;
  careersWelcome: string;
  careersMission: string;
  careersValues: string[];
  careersWhyJoin: string;
  careersLogoUrl: string;
  careersCoverImageUrl: string;
  careersBrandColor: string;
};

type SchoolData = Branding & {
  id: string;
  name: string;
  slug: string;
  careersBrandingPublished: boolean;
};

const emptyBranding: Branding = {
  careersMotto: "",
  careersWelcome: "",
  careersMission: "",
  careersValues: [],
  careersWhyJoin: "",
  careersLogoUrl: "",
  careersCoverImageUrl: "",
  careersBrandColor: "#4f46e5",
};

const fields: {
  key: keyof Pick<
    Branding,
    "careersMotto" | "careersWelcome" | "careersMission" | "careersWhyJoin"
  >;
  label: string;
  help: string;
  rows: number;
}[] = [
  {
    key: "careersMotto",
    label: "School motto or headline",
    help: "A short statement displayed prominently on the careers page.",
    rows: 2,
  },
  {
    key: "careersWelcome",
    label: "Welcome message",
    help: "Introduce candidates to your school and its recruitment approach.",
    rows: 4,
  },
  {
    key: "careersMission",
    label: "Our mission",
    help: "Explain the school's educational purpose and mission.",
    rows: 4,
  },
  {
    key: "careersWhyJoin",
    label: "Why join our school?",
    help: "Describe the team, culture, development opportunities, and benefits.",
    rows: 4,
  },
];

export function CareersBrandingManagement({
  schoolId,
}: {
  schoolId: string;
}) {
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [branding, setBranding] = useState<Branding>(emptyBranding);
  const [valuesText, setValuesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/careers-branding`,
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to load careers branding.");
      }

      const current = result.school as SchoolData;
      setSchool(current);
      setBranding({
        careersMotto: current.careersMotto || "",
        careersWelcome: current.careersWelcome || "",
        careersMission: current.careersMission || "",
        careersValues: current.careersValues || [],
        careersWhyJoin: current.careersWhyJoin || "",
        careersLogoUrl: current.careersLogoUrl || "",
        careersCoverImageUrl: current.careersCoverImageUrl || "",
        careersBrandColor: current.careersBrandColor || "#4f46e5",
      });
      setValuesText((current.careersValues || []).join("\n"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load careers branding.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Load once for the active school.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  function update<K extends keyof Branding>(key: K, value: Branding[K]) {
    setBranding((current) => ({ ...current, [key]: value }));
  }

  const [uploading, setUploading] = useState<"logo" | "cover" | "">("");

  async function uploadImage(kind: "logo" | "cover", file: File) {
    setUploading(kind);
    setError("");
    setNotice("");

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("kind", kind);

      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/careers-branding/images`,
        { method: "POST", body: form },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to upload image.");
      }

      update(kind === "logo" ? "careersLogoUrl" : "careersCoverImageUrl", result.url);
      setNotice(kind === "logo"
        ? "Logo uploaded to the draft. Save and publish to make it public."
        : "Cover image uploaded to the draft. Save and publish to make it public.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload image.");
    } finally {
      setUploading("");
    }
  }

  async function performAction(action: "save" | "publish" | "unpublish") {
    setSaving(true);
    setError("");
    setNotice("");

    const values = valuesText
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    if (values.length > 8) {
      setSaving(false);
      setError("Please enter no more than 8 core values.");
      return;
    }

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/careers-branding`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...branding,
            careersValues: values,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to update careers branding.");
      }

      const updated = result.school as SchoolData;
      setSchool(updated);
      setBranding({
        careersMotto: updated.careersMotto || "",
        careersWelcome: updated.careersWelcome || "",
        careersMission: updated.careersMission || "",
        careersValues: updated.careersValues || [],
        careersWhyJoin: updated.careersWhyJoin || "",
        careersLogoUrl: updated.careersLogoUrl || "",
        careersCoverImageUrl: updated.careersCoverImageUrl || "",
        careersBrandColor: updated.careersBrandColor || "#4f46e5",
      });
      setValuesText((updated.careersValues || []).join("\n"));
      setNotice(
        action === "publish"
          ? "Careers branding published successfully."
          : action === "unpublish"
            ? "Custom careers branding unpublished. The default design is now public."
            : "Draft saved. Your public page has not been changed.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update careers branding.",
      );
    } finally {
      setSaving(false);
    }
  }

  const publicUrl = school
    ? `/careers/${encodeURIComponent(school.slug)}`
    : "";

  if (loading) {
    return (
      <div className="w-full px-5 py-5 text-sm text-slate-600 sm:px-6 lg:px-7 xl:px-8">
        Loading careers branding…
      </div>
    );
  }

  if (!school) {
    return (
      <div className="w-full px-5 py-5 sm:px-6 lg:px-7 xl:px-8">
        <p role="alert" className="text-sm text-red-700">
          {error || "Unable to load careers branding."}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <main className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Recruitment
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Careers page
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Customize how candidates discover {school.name}. Save a private
            draft, then publish it when your school is ready.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              school.careersBrandingPublished
                ? "bg-emerald-50 text-emerald-800"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            {school.careersBrandingPublished ? "Custom branding published" : "Draft / default public design"}
          </span>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open public page ↗
          </a>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-bold text-slate-950">School identity</h2>
          <p className="mt-1 text-sm text-slate-600">
            Use your official school identity and brand colors.
          </p>

          <div className="mt-5 space-y-5">
            {fields.map((field) => (
              <label key={field.key} className="block">
                <span className="font-semibold text-slate-800">{field.label}</span>
                <textarea
                  rows={field.rows}
                  maxLength={field.key === "careersMotto" ? 180 : 3000}
                  value={branding[field.key]}
                  onChange={(event) => update(field.key, event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <span className="mt-1 block text-xs text-slate-500">{field.help}</span>
              </label>
            ))}

            <label className="block">
              <span className="font-semibold text-slate-800">Core values</span>
              <textarea
                rows={5}
                value={valuesText}
                onChange={(event) => {
                  setValuesText(event.target.value);
                  update(
                    "careersValues",
                    event.target.value.split("\n").map((value) => value.trim()).filter(Boolean),
                  );
                }}
                placeholder={"Integrity\nExcellence\nRespect\nInnovation"}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="mt-1 block text-xs text-slate-500">
                One value per line, maximum 8 values and 120 characters each.
              </span>
            </label>

            <label className="block">
              <span className="font-semibold text-slate-800">Brand color</span>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(branding.careersBrandColor) ? branding.careersBrandColor : "#4f46e5"}
                  onChange={(event) => update("careersBrandColor", event.target.value)}
                  className="size-11 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                  aria-label="Choose school brand color"
                />
                <input
                  value={branding.careersBrandColor}
                  onChange={(event) => update("careersBrandColor", event.target.value)}
                  placeholder="#4f46e5"
                  maxLength={7}
                  className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
                />
              </div>
              <span className="mt-1 block text-xs text-slate-500">
                Enter a six-digit hex color, such as #263A80.
              </span>
            </label>

            <label className="block">
              <span className="font-semibold text-slate-800">Logo image URL</span>
              <input
                type="url"
                value={branding.careersLogoUrl}
                onChange={(event) => update("careersLogoUrl", event.target.value)}
                placeholder="https://example.com/school-logo.png"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Optional public HTTP or HTTPS image URL.
              </span>
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
                <span className="block text-sm font-medium text-slate-700">
                  Upload logo from your device
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploading !== ""}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage("logo", file);
                    event.target.value = "";
                  }}
                  className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold file:text-slate-700"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  JPEG, PNG, WebP or GIF. Maximum 5 MB.
                </span>
                {uploading === "logo" && (
                  <span className="mt-2 block text-xs font-medium text-indigo-700">
                    Uploading logo…
                  </span>
                )}
              </div>
            </label>

            <label className="block">
              <span className="font-semibold text-slate-800">Hero cover image URL</span>
              <input
                type="url"
                value={branding.careersCoverImageUrl}
                onChange={(event) => update("careersCoverImageUrl", event.target.value)}
                placeholder="https://example.com/school-campus.jpg"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Optional image displayed behind the careers headline.
              </span>
              <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
                <span className="block text-sm font-medium text-slate-700">
                  Upload cover image from your device
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploading !== ""}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage("cover", file);
                    event.target.value = "";
                  }}
                  className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold file:text-slate-700"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  JPEG, PNG, WebP or GIF. Maximum 5 MB.
                </span>
                {uploading === "cover" && (
                  <span className="mt-2 block text-xs font-medium text-indigo-700">
                    Uploading cover image…
                  </span>
                )}
              </div>
            </label>
          </div>

          <div className="mt-7 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
            <button
              type="button"
              disabled={saving}
              onClick={() => void performAction("save")}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? "Working…" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void performAction("publish")}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Publish branding
            </button>
            {school.careersBrandingPublished && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (window.confirm("Unpublish custom careers branding? The public page will return to its default design.")) {
                    void performAction("unpublish");
                  }
                }}
                className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Unpublish
              </button>
            )}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Saving changes the private draft only. Publishing makes the current
            branding public. Unpublishing restores the default public design;
            your saved draft fields remain available for later editing.
          </p>
        </section>

        <aside className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Draft preview — not public</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              This preview reflects your current unsaved edits. The public page
              changes only after you publish.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div
              className="p-6 text-white sm:p-8"
              style={{
                backgroundColor: /^#[0-9a-fA-F]{6}$/.test(branding.careersBrandColor)
                  ? branding.careersBrandColor
                  : "#1e1b4b",
                ...(branding.careersCoverImageUrl
                  ? {
                      backgroundImage: `linear-gradient(90deg, rgba(15,23,42,.9), rgba(15,23,42,.7)), url("${branding.careersCoverImageUrl}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : {}),
              }}
            >
              <div className="flex items-center gap-3">
                {branding.careersLogoUrl ? (
                  <img
                    src={branding.careersLogoUrl}
                    alt=""
                    className="size-12 rounded-xl bg-white object-contain p-1"
                  />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">
                    {school.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                  </span>
                )}
                <span className="font-bold">{school.name}</span>
              </div>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                Build your future with us
              </p>
              <h3 className="mt-3 text-2xl font-bold leading-tight">
                {branding.careersMotto || "Make a difference. Shape the future."}
              </h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/90">
                {branding.careersWelcome || "Bring your skills, experience, and passion for education to our school. Explore open positions and apply online."}
              </p>
            </div>
            {(branding.careersMission || branding.careersWhyJoin || branding.careersValues.length > 0) && (
              <div className="space-y-4 p-5">
                {branding.careersMission && (
                  <div>
                    <h4 className="font-bold text-slate-900">Our mission</h4>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">{branding.careersMission}</p>
                  </div>
                )}
                {branding.careersValues.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900">Our core values</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {branding.careersValues.filter(Boolean).slice(0, 8).map((value, index) => (
                        <span key={`${value}-${index}`} className="rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: branding.careersBrandColor, color: branding.careersBrandColor }}>
                          {value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {branding.careersWhyJoin && (
                  <div>
                    <h4 className="font-bold text-slate-900">Why join us?</h4>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">{branding.careersWhyJoin}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
