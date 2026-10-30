"use client";

import { useEffect, useState, type FormEvent } from "react";

type DocumentType =
  | "CV"
  | "EDUCATIONAL_CERTIFICATE"
  | "EXPERIENCE_LETTER"
  | "APPLICATION_LETTER"
  | "OTHER";

type Requirement = {
  documentType: DocumentType;
  label: string | null;
  isRequired: boolean;
};

type Job = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  employmentType: string;
  openingDate: string | null;
  closingDate: string | null;
  documentRequirements: Requirement[];
};

type SchoolBranding = {
  motto: string | null;
  welcome: string | null;
  mission: string | null;
  values: string[];
  whyJoin: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  brandColor: string | null;
};

type CareersData = {
  school: {
    name: string;
    slug: string;
    city: string | null;
    branding: SchoolBranding | null;
  };
  jobs: Job[];
};

const documents: { type: DocumentType; label: string }[] = [
  { type: "CV", label: "Curriculum vitae (CV)" },
  { type: "EDUCATIONAL_CERTIFICATE", label: "Educational certificates" },
  { type: "EXPERIENCE_LETTER", label: "Experience letters" },
  { type: "APPLICATION_LETTER", label: "Application letter" },
  { type: "OTHER", label: "Other supporting document" },
];

const acceptedFiles =
  ".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function PublicCareersPage({
  schoolSlug,
}: {
  schoolSlug: string;
}) {
  const [data, setData] = useState<CareersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [files, setFiles] = useState<Partial<Record<DocumentType, File>>>({});
  const [candidateName, setCandidateName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCareers() {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch(
          `/api/public/careers/${encodeURIComponent(schoolSlug)}`,
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load current vacancies.");
        }

        if (active) setData(result as CareersData);
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load current vacancies.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCareers();
    return () => {
      active = false;
    };
  }, [schoolSlug]);

  function startApplication(job: Job) {
    setSelectedJob(job);
    setFiles({});
    setCandidateName("");
    setEmail("");
    setPhone("");
    setMessage("");
    setSuccess(false);
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJob || submitting) return;

    if (!email.trim() && !phone.trim()) {
      setMessage("Please provide an email address or phone number.");
      return;
    }

    const requirements = new Map(
      selectedJob.documentRequirements.map((item) => [
        item.documentType,
        item,
      ]),
    );

    for (const document of documents) {
      const requirement = requirements.get(document.type);
      if (requirement?.isRequired && !files[document.type]) {
        setMessage(`${requirement.label || document.label} is required.`);
        return;
      }
    }

    const chosenFiles = Object.values(files).filter(
      (file): file is File => Boolean(file),
    );
    if (chosenFiles.some((file) => file.size > 10 * 1024 * 1024)) {
      setMessage("Each document must be 10 MB or smaller.");
      return;
    }
    if (
      chosenFiles.reduce((total, file) => total + file.size, 0) >
      25 * 1024 * 1024
    ) {
      setMessage("The total size of all documents must not exceed 25 MB.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const body = new FormData();
      body.set("jobOpeningId", selectedJob.id);
      body.set("candidateName", candidateName.trim());
      body.set("email", email.trim());
      body.set("phone", phone.trim());

      for (const [type, file] of Object.entries(files)) {
        if (file) body.set(`document_${type}`, file);
      }

      const response = await fetch(
        `/api/public/careers/${encodeURIComponent(schoolSlug)}/applications`,
        { method: "POST", body },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Application submission failed.");
      }

      setSuccess(true);
      setMessage(
        result.message ||
          "Your application has been submitted successfully.",
      );
      setSelectedJob(null);
      setFiles({});
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Application submission failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[oklch(0.985_0.002_260)] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <a
            href={"/careers/" + encodeURIComponent(schoolSlug)}
            className="flex min-w-0 items-center gap-3"
          >
            {data?.school.branding?.logoUrl ? (
              <img
                src={data.school.branding.logoUrl}
                alt={data.school.name + " logo"}
                className="size-11 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-sm"
              />
            ) : (
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                style={{
                  backgroundColor:
                    data?.school.branding?.brandColor || "#4f46e5",
                }}
              >
                {(data?.school.name || "SC")
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-base font-bold tracking-tight text-slate-950">
                {data?.school.name || "School careers"}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Official recruitment portal
              </span>
            </span>
          </a>
          <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 sm:inline-flex">
            <span className="size-2 rounded-full bg-emerald-500" />
            Careers & opportunities
          </span>
        </div>
      </header>

      <section className="px-5 pb-10 pt-7 sm:px-8 sm:pb-14 sm:pt-10 lg:px-10">
        <div
          className="relative overflow-hidden rounded-3xl px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14 lg:py-16"
          style={{
            backgroundColor:
              data?.school.branding?.brandColor || "#1e1b4b",
            ...(data?.school.branding?.coverImageUrl
              ? {
                  backgroundImage:
                    'linear-gradient(90deg, rgba(15,23,42,0.88), rgba(15,23,42,0.68)), url("' +
                    data.school.branding.coverImageUrl +
                    '")',
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {}),
          }}
        >
          <div className="pointer-events-none absolute -right-20 -top-32 size-80 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-4 -top-16 size-56 rounded-full border border-white/10" />
          <div className="relative grid gap-8 md:grid-cols-[minmax(0,1fr)_240px] md:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
                Build your future with us
              </p>
              <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                {data?.school.branding?.motto ? (
                  data.school.branding.motto
                ) : (
                  <>
                    Make a difference.
                    <span className="block text-indigo-300">
                      Shape the future.
                    </span>
                  </>
                )}
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-indigo-100 sm:text-base">
                {data?.school.branding?.welcome ||
                  "Bring your skills, experience, and passion for education to our school. Explore open positions and apply online."}
              </p>
              <a
                href="#open-positions"
                className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
                style={{
                  color: data?.school.branding?.brandColor || "#1e1b4b",
                }}
              >
                Explore open positions
                <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm">
              <p className="text-xs font-medium text-indigo-200">
                Current opportunities
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight">
                {loading ? "—" : loadError ? "—" : (data?.jobs.length ?? 0)}
              </p>
              <p className="mt-2 text-sm leading-6 text-indigo-100">
                {loading
                  ? "Checking available positions"
                  : loadError
                    ? "Positions could not be loaded"
                    : data?.jobs.length === 1
                      ? "Position accepting applications"
                      : "Published positions accepting applications"}
              </p>
              {data?.school.city && (
                <p className="mt-4 border-t border-white/15 pt-4 text-xs text-indigo-200">
                  <span aria-hidden="true">⌖ </span>
                  {data.school.city}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {(data?.school.branding?.mission ||
        data?.school.branding?.values?.length ||
        data?.school.branding?.whyJoin) && (
        <section className="px-5 pb-12 sm:px-8 lg:px-10">
          <div className="grid gap-5 md:grid-cols-2">
            {data.school.branding.mission && (
              <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
                <p
                  className="text-xs font-bold uppercase tracking-[0.16em]"
                  style={{
                    color: data.school.branding.brandColor || "#4f46e5",
                  }}
                >
                  Our mission
                </p>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                  {data.school.branding.mission}
                </p>
              </article>
            )}

            {data.school.branding.whyJoin && (
              <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
                <p
                  className="text-xs font-bold uppercase tracking-[0.16em]"
                  style={{
                    color: data.school.branding.brandColor || "#4f46e5",
                  }}
                >
                  Why join us?
                </p>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                  {data.school.branding.whyJoin}
                </p>
              </article>
            )}

            {data.school.branding.values.length > 0 && (
              <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:col-span-2 sm:p-7">
                <p
                  className="text-xs font-bold uppercase tracking-[0.16em]"
                  style={{
                    color: data.school.branding.brandColor || "#4f46e5",
                  }}
                >
                  Our core values
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.school.branding.values.map((value) => (
                    <span
                      key={value}
                      className="rounded-full border px-3 py-2 text-sm font-medium"
                      style={{
                        borderColor:
                          data.school.branding?.brandColor || "#c7d2fe",
                        color: data.school.branding?.brandColor || "#3730a3",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </article>
            )}
          </div>
        </section>
      )}

      <section
        id="open-positions"
        className="px-5 pb-14 sm:px-8 lg:px-10"
      >
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
              Find your next opportunity
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Open positions
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review the role details and requirements before submitting your
              application.
            </p>
          </div>
          {!loading && !loadError && data?.jobs.length ? (
            <span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
              {data.jobs.length} {data.jobs.length === 1 ? "position" : "positions"}
            </span>
          ) : null}
        </div>

        {loading && (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="h-3 w-28 rounded bg-slate-200" />
                <div className="mt-4 h-6 w-3/5 rounded bg-slate-200" />
                <div className="mt-4 h-3 w-full rounded bg-slate-100" />
                <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
                <div className="mt-7 h-10 w-32 rounded-lg bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-2xl border border-red-200 bg-white p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-lg text-red-700">
                !
              </span>
              <div>
                <h3 className="font-semibold text-slate-950">
                  We couldn’t load the vacancies
                </h3>
                <p role="alert" className="mt-2 text-sm leading-6 text-red-700">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && !loadError && data?.jobs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-700">
              ✦
            </span>
            <h3 className="mt-5 text-lg font-semibold text-slate-950">
              No current vacancies
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              There are no published positions at the moment. Please check
              back later for new opportunities.
            </p>
          </div>
        )}

        {!loading && !loadError && (data?.jobs.length ?? 0) > 0 && (
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {data?.jobs.map((job) => (
              <article
                key={job.id}
                className={
                  "min-w-0 overflow-hidden rounded-2xl border bg-white transition " +
                  (selectedJob?.id === job.id
                    ? "border-indigo-300 shadow-md shadow-indigo-950/5"
                    : "border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md")
                }
              >
                <div className="p-5 sm:p-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      Accepting applications
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {job.employmentType.replaceAll("_", " ")}
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-bold leading-snug tracking-tight text-slate-950 sm:text-2xl">
                    {job.title}
                  </h3>

                  {job.department && (
                    <p className="mt-2 text-sm font-medium text-indigo-700">
                      {job.department}
                    </p>
                  )}

                  {job.description ? (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                      {job.description}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-slate-500">
                      Contact the school through the application form to
                      express your interest in this position.
                    </p>
                  )}

                  <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    {job.openingDate && (
                      <p>
                        <span className="font-semibold text-slate-700">
                          Published
                        </span>{" "}
                        {formatDate(job.openingDate)}
                      </p>
                    )}
                    {job.closingDate && (
                      <p>
                        <span className="font-semibold text-slate-700">
                          Deadline
                        </span>{" "}
                        {formatDate(job.closingDate)}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => startApplication(job)}
                    aria-expanded={selectedJob?.id === job.id}
                    className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
                  >
                    {selectedJob?.id === job.id
                      ? "Application form open"
                      : "Apply for this position"}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>

                {selectedJob?.id === job.id && (
                  <form
                    key={job.id}
                    onSubmit={submitApplication}
                    className="border-t border-indigo-100 bg-slate-50/80 p-5 sm:p-7"
                  >
                    <div className="mb-6">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">
                        Online application
                      </p>
                      <h4 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                        Apply for {job.title}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Complete your details and attach the supporting
                        documents for your application.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="candidate-name"
                          className="mb-1.5 block text-sm font-semibold text-slate-800"
                        >
                          Full name <span className="text-red-600">*</span>
                        </label>
                        <input
                          id="candidate-name"
                          required
                          autoComplete="name"
                          value={candidateName}
                          onChange={(event) => setCandidateName(event.target.value)}
                          placeholder="Enter your full name"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="candidate-email"
                            className="mb-1.5 block text-sm font-semibold text-slate-800"
                          >
                            Email address
                          </label>
                          <input
                            id="candidate-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@example.com"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="candidate-phone"
                            className="mb-1.5 block text-sm font-semibold text-slate-800"
                          >
                            Phone number
                          </label>
                          <input
                            id="candidate-phone"
                            type="tel"
                            autoComplete="tel"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            placeholder="Enter your phone number"
                            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                          />
                        </div>
                      </div>
                      <p className="-mt-1 text-xs leading-5 text-slate-500">
                        Provide at least one contact method: email or phone.
                      </p>
                    </div>

                    <div className="mt-8 border-t border-slate-200 pt-6">
                      <h5 className="text-base font-semibold text-slate-950">
                        Supporting documents
                      </h5>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Upload PDF, Word, JPG, or PNG files. Each file must be
                        10 MB or smaller; all files combined must not exceed
                        25 MB. Required documents are marked with an asterisk.
                      </p>

                      <div className="mt-5 space-y-3">
                        {documents.map((document) => {
                          const requirement = requirementsFor(job, document.type);
                          const label = requirement?.label || document.label;
                          const chosenFile = files[document.type];

                          return (
                            <label
                              key={document.type}
                              className="block rounded-xl border border-slate-200 bg-white p-4"
                            >
                              <span className="flex items-start justify-between gap-3">
                                <span className="text-sm font-semibold text-slate-800">
                                  {label}
                                  {requirement?.isRequired && (
                                    <span className="ml-1 text-red-600">*</span>
                                  )}
                                </span>
                                {chosenFile && (
                                  <span className="shrink-0 text-xs font-medium text-emerald-700">
                                    Attached
                                  </span>
                                )}
                              </span>
                              <input
                                type="file"
                                accept={acceptedFiles}
                                required={Boolean(requirement?.isRequired)}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  setFiles((current) => {
                                    const next = { ...current };
                                    if (file) next[document.type] = file;
                                    else delete next[document.type];
                                    return next;
                                  });
                                }}
                                className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                              />
                              {chosenFile && (
                                <span className="mt-2 block break-all text-xs text-slate-500">
                                  {chosenFile.name}
                                  {" · "}
                                  {(chosenFile.size / (1024 * 1024)).toFixed(2)}
                                  {" MB"}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {message && !success && (
                      <div
                        role="alert"
                        className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
                      >
                        {message}
                      </div>
                    )}

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submitting ? (
                          <>
                            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            Submitting application…
                          </>
                        ) : (
                          "Submit application"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedJob(null)}
                        disabled={submitting}
                        className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                      Please review your information before submitting.
                    </p>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}

        {success && message && (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-900"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Application received</p>
              <p className="mt-1">{message}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSuccess(false);
                setMessage("");
              }}
              aria-label="Dismiss application confirmation"
              className="rounded-lg px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-7 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-sm font-semibold text-slate-700">
            {data?.school.name || "School careers"}
          </p>
          <p className="text-xs text-slate-500">
            Recruitment portal powered by SKUDA
          </p>
        </div>
      </footer>
    </main>
  );
}

function requirementsFor(job: Job, type: DocumentType) {
  return job.documentRequirements.find(
    (requirement) => requirement.documentType === type,
  );
}
