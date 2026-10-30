"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  AlertTriangle,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Send,
  Star,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffPerformanceAnalytics } from "@/components/hr/staff-performance-analytics";
import { StaffPerformanceGoals } from "@/components/hr/staff-performance-goals";
import { StaffPerformanceCompetencyFrameworks } from "@/components/hr/staff-performance-competency-frameworks";

type Person = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  staffNumber?: string | null;
  employeeNumber?: string | null;
  userId?: string | null;
  user?: { id?: string; name?: string | null; email?: string | null } | null;
};

type Competency = {
  competency: string;
  rating: number;
  evidence: string;
  frameworkId?: string | null;
  frameworkCompetencyId?: string | null;
  frameworkNameSnapshot?: string | null;
  descriptionSnapshot?: string | null;
  ratingCriteriaSnapshot?: {
    rating1Criteria?: string;
    rating2Criteria?: string;
    rating3Criteria?: string;
    rating4Criteria?: string;
    rating5Criteria?: string;
  } | null;
};

type CompetencyDefinition = {
  id: string;
  name: string;
  description?: string | null;
  rating1Criteria: string;
  rating2Criteria: string;
  rating3Criteria: string;
  rating4Criteria: string;
  rating5Criteria: string;
  isActive: boolean;
};

type CompetencyFramework = {
  id: string;
  name: string;
  description?: string | null;
  competencies: CompetencyDefinition[];
};

type Review = {
  id: string;
  reviewerId: string;
  status: string;
  overallRating?: number | null;
  strengths?: string | null;
  improvementAreas?: string | null;
  reviewerComments?: string | null;
  employeeComments?: string | null;
  submittedAt?: string | null;
  acknowledgedAt?: string | null;
  staffProfile?: Person | null;
  reviewer?: Person | null;
  competencies?: Competency[];
};

type Cycle = {
  id: string;
  name: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  reviews: Review[];
  createdAt?: string;
};

type Assignment = {
  staffProfileId: string;
  reviewerId: string;
};

type ReviewEditor = {
  overallRating: string;
  strengths: string;
  improvementAreas: string;
  reviewerComments: string;
  competencies: Competency[];
};

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
const textAreaClass =
  "min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
const buttonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

const emptyEditor = (): ReviewEditor => ({
  overallRating: "",
  strengths: "",
  improvementAreas: "",
  reviewerComments: "",
  competencies: [{ competency: "", rating: 3, evidence: "" }],
});

function personName(person?: Person | null): string {
  if (!person) return "Unknown";
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return (
    fullName ||
    person.name ||
    person.user?.name ||
    person.user?.email ||
    person.staffNumber ||
    person.employeeNumber ||
    "Unnamed employee"
  );
}

function dateLabel(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function statusClass(status: string): string {
  switch (status) {
    case "OPEN":
    case "SUBMITTED":
    case "ACKNOWLEDGED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "CLOSED":
    case "REJECTED":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-800";
  }
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return body.error || body.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export function StaffPerformanceManagement({
  schoolId,
}: {
  schoolId: string;
}) {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [employees, setEmployees] = useState<Person[]>([]);
  const [reviewers, setReviewers] = useState<Person[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isManager, setIsManager] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [editor, setEditor] = useState<ReviewEditor>(emptyEditor);
  const [competencyFrameworks, setCompetencyFrameworks] = useState<CompetencyFramework[]>([]);
  const [selectedFrameworkId, setSelectedFrameworkId] = useState("");
  const [cycleName, setCycleName] = useState("");
  const [cycleDescription, setCycleDescription] = useState("");
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().slice(0, 10);
  });
  const [assignments, setAssignments] = useState<Assignment[]>([
    { staffProfileId: "", reviewerId: "" },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const baseUrl = `/api/schools/${encodeURIComponent(schoolId)}/performance`;
  const selectedCycle = cycles.find((cycle) => cycle.id === selectedCycleId);
  const selectedReview = selectedCycle?.reviews.find(
    (review) => review.id === selectedReviewId,
  );

  const load = useCallback(async (preserveCycle = true) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(baseUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(await responseMessage(response));
      const data = (await response.json()) as {
        cycles?: Cycle[];
        employees?: Person[];
        reviewers?: Person[];
      currentUserId?: string;
      isManager?: boolean;
      };
      const nextCycles = data.cycles ?? [];
      setCycles(nextCycles);
      setEmployees(data.employees ?? []);
      setReviewers(data.reviewers ?? []);
    setCurrentUserId(data.currentUserId ?? "");
    setIsManager(data.isManager === true);
      setSelectedCycleId((current) => {
        if (preserveCycle && nextCycles.some((cycle) => cycle.id === current)) {
          return current;
        }
        return nextCycles[0]?.id ?? "";
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load performance data.",
      );
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void load(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [load]);

  useEffect(() => {
    if (!showCreateForm && !confirmation) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        setShowCreateForm(false);
        setConfirmation(null);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showCreateForm, confirmation, saving]);

  const stats = useMemo(() => {
    const allReviews = cycles.flatMap((cycle) => cycle.reviews ?? []);
    return {
      cycles: cycles.length,
      assigned: allReviews.length,
      submitted: allReviews.filter(
        (review) =>
          review.status === "SUBMITTED" || review.status === "ACKNOWLEDGED",
      ).length,
      acknowledged: allReviews.filter(
        (review) => review.status === "ACKNOWLEDGED",
      ).length,
    };
  }, [cycles]);

  function updateAssignment(
    index: number,
    field: keyof Assignment,
    value: string,
  ) {
    setAssignments((current) =>
      current.map((assignment, i) =>
        i === index ? { ...assignment, [field]: value } : assignment,
      ),
    );
  }

  async function createCycle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!cycleName.trim()) {
      setError("Enter a name for this review cycle.");
      return;
    }
    if (endDate < startDate) {
      setError("The end date must be on or after the start date.");
      return;
    }
    if (assignments.length === 0 || assignments.some(
      (assignment) => !assignment.staffProfileId || !assignment.reviewerId,
    )) {
      setError("Choose an employee and reviewer for every assignment.");
      return;
    }
    const selfReview = assignments.some((assignment) => {
      const employee = employees.find(
        (item) => item.id === assignment.staffProfileId,
      );
      return Boolean(
        employee?.userId && employee.userId === assignment.reviewerId,
      );
    });
    if (selfReview) {
      setError("Employees cannot be assigned to review their own performance.");
      return;
    }

    const employeeIds = assignments.map((item) => item.staffProfileId);
    if (new Set(employeeIds).size !== employeeIds.length) {
      setError("Each employee can only be assigned once in a cycle.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cycleName.trim(),
          description: cycleDescription.trim() || undefined,
          startDate,
          endDate,
          assignments,
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setNotice("Review cycle created successfully.");
      setCycleName("");
      setCycleDescription("");
      setAssignments([{ staffProfileId: "", reviewerId: "" }]);
      setShowCreateForm(false);
      await load(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to create cycle.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeCycleStatus(status: "OPEN" | "CLOSED") {
    if (!selectedCycle) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(selectedCycle.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setNotice(`Review cycle ${status === "OPEN" ? "opened" : "closed"}.`);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update review cycle.",
      );
    } finally {
      setSaving(false);
    }
  }

  function requestCycleStatus(status: "OPEN" | "CLOSED") {
    if (!selectedCycle) return;
    const opening = status === "OPEN";
    setConfirmation({
      title: opening ? "Open review cycle?" : "Close review cycle?",
      description: opening
        ? `“${selectedCycle.name}” will become active. Assigned reviewers will be able to complete their reviews. Verify the review period and assignments before continuing.`
        : `“${selectedCycle.name}” will be closed. Reviewers will no longer be able to complete reviews in this cycle.`,
      confirmLabel: opening ? "Open cycle" : "Close cycle",
      destructive: !opening,
      onConfirm: () => {
        setConfirmation(null);
        void changeCycleStatus(status);
      },
    });
  }

  async function openReview(reviewId: string) {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch(
        `${baseUrl}/reviews/${encodeURIComponent(reviewId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as { review?: Review } & Review;
      const review = payload.review ?? payload;
      const staffProfileId = review.staffProfile?.id;
      const frameworksResponse = await fetch(
        `${baseUrl}/competency-frameworks${staffProfileId ? `?staffProfileId=${encodeURIComponent(staffProfileId)}` : ""}`,
        { cache: "no-store" },
      );
      if (!frameworksResponse.ok) {
        throw new Error(await responseMessage(frameworksResponse));
      }
      const frameworksPayload = (await frameworksResponse.json()) as {
        frameworks?: CompetencyFramework[];
      };
      const availableFrameworks = frameworksPayload.frameworks ?? [];
      setCompetencyFrameworks(availableFrameworks);
      setSelectedReviewId(reviewId);
      setSelectedFrameworkId(
        review.competencies?.find((item) => item.frameworkId)?.frameworkId ?? "",
      );
      setEditor({
        overallRating:
          review.overallRating == null ? "" : String(review.overallRating),
        strengths: review.strengths ?? "",
        improvementAreas: review.improvementAreas ?? "",
        reviewerComments: review.reviewerComments ?? "",
        competencies:
          review.competencies?.length
            ? review.competencies.map((item) => ({
                competency: item.competency,
                rating: item.rating,
                evidence: item.evidence ?? "",
                frameworkId: item.frameworkId ?? null,
                frameworkCompetencyId: item.frameworkCompetencyId ?? null,
                frameworkNameSnapshot: item.frameworkNameSnapshot ?? null,
                descriptionSnapshot: item.descriptionSnapshot ?? null,
                ratingCriteriaSnapshot: item.ratingCriteriaSnapshot ?? null,
              }))
            : [{ competency: "", rating: 3, evidence: "" }],
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load review.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveReview(action: "save" | "submit") {
    if (!selectedReview || !selectedCycle) return;
    setError("");
    setNotice("");

    const competencies = editor.competencies
      .map((item) => ({
        competency: item.competency.trim(),
        rating: Number(item.rating),
        evidence: item.evidence.trim() || undefined,
        ...(item.frameworkId ? { frameworkId: item.frameworkId } : {}),
        ...(item.frameworkCompetencyId
          ? { frameworkCompetencyId: item.frameworkCompetencyId }
          : {}),
      }))
      .filter((item) => item.competency);

    if (action === "submit") {
      if (!editor.overallRating) {
        setError("Choose an overall rating before submitting.");
        return;
      }
      if (
        !editor.strengths.trim() ||
        !editor.improvementAreas.trim() ||
        !editor.reviewerComments.trim()
      ) {
        setError(
          "Complete strengths, improvement areas, and reviewer comments before submitting.",
        );
        return;
      }
      if (competencies.length === 0) {
        setError("Add at least one competency before submitting.");
        return;
      }
    }
    if (editor.competencies.some(
      (item) => item.competency.trim() && (!Number.isInteger(Number(item.rating)) ||
        Number(item.rating) < 1 || Number(item.rating) > 5),
    )) {
      setError("Competency ratings must be whole numbers from 1 to 5.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `${baseUrl}/reviews/${encodeURIComponent(selectedReview.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            overallRating: editor.overallRating
              ? Number(editor.overallRating)
              : null,
            strengths: editor.strengths,
            improvementAreas: editor.improvementAreas,
            reviewerComments: editor.reviewerComments,
            competencies,
            action,
          }),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setNotice(
        action === "submit"
          ? "Supervisor review submitted."
          : "Review draft saved.",
      );
      await load();
      if (action === "submit") setSelectedReviewId("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save review.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateCompetency(
    index: number,
    field: keyof Competency,
    value: string | number,
  ) {
    setEditor((current) => ({
      ...current,
      competencies: current.competencies.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function applyCompetencyFramework() {
    const framework = competencyFrameworks.find(
      (item) => item.id === selectedFrameworkId,
    );
    if (!framework) {
      setError("Choose an available competency framework first.");
      return;
    }
    const definitions = framework.competencies.filter((item) => item.isActive);
    if (!definitions.length) {
      setError("This framework has no active competencies.");
      return;
    }
    setError("");
    setEditor((current) => ({
      ...current,
      competencies: definitions.map((definition) => ({
        competency: definition.name,
        rating: 3,
        evidence: "",
        frameworkId: framework.id,
        frameworkCompetencyId: definition.id,
      })),
    }));
  }

  const canEditReview =
    currentUserId !== "" &&
    selectedCycle?.status === "OPEN" &&
    selectedReview != null &&
    selectedReview.reviewerId === currentUserId &&
    !["SUBMITTED", "ACKNOWLEDGED"].includes(selectedReview.status);

  return (
    <div className="w-full space-y-4 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <TrendingUp className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              People &amp; HR
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Performance reviews
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isManager
                ? "Manage review cycles, supervisor assignments, and staff feedback."
                : "Review only the staff performance evaluations assigned to you."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManager && (
            <>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => void load()}
            disabled={loading || saving}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => setShowCreateForm((value) => !value)}
            disabled={saving}
          >
            {showCreateForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showCreateForm ? "Cancel" : "New review cycle"}
          </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
          <button type="button" className="ml-auto" onClick={() => setError("")} aria-label="Dismiss error">
            <X className="size-4" />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="size-4 shrink-0" />
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Review cycles", value: stats.cycles, icon: ClipboardCheck },
          { label: "Assigned reviews", value: stats.assigned, icon: Users },
          { label: "Submitted", value: stats.submitted, icon: Send },
          { label: "Acknowledged", value: stats.acknowledged, icon: CheckCircle2 },
        ].map((item) => (
          <div key={item.label} className="group rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-shadow hover:shadow-md md:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <item.icon className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

            <div className="grid grid-cols-1 items-start gap-3">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
          <div className="border-b border-border bg-muted/20 px-4 py-4 md:px-5">
            <h2 className="text-sm font-semibold tracking-tight">Review cycles</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select a cycle to manage its reviews.</p>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading cycles…</div>
          ) : cycles.length === 0 ? (
            <div className="p-6 text-center">
              <ClipboardCheck className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No review cycles yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a cycle to start assigning supervisor reviews.</p>
            </div>
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Review cycle</th>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Reviews</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"><span className="sr-only">Selection</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cycles.map((cycle) => (
                    <tr key={cycle.id} className={`cursor-pointer transition-colors hover:bg-muted/30 ${selectedCycleId === cycle.id ? "bg-primary/[0.06]" : ""}`}>
                      <td className="p-0">
                        <button type="button" onClick={() => { setSelectedCycleId(cycle.id); setSelectedReviewId(""); setError(""); }} className="block w-full px-5 py-4 text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                          {cycle.name}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{dateLabel(cycle.startDate)} – {dateLabel(cycle.endDate)}</td>
                      <td className="px-4 py-4 tabular-nums">{cycle.reviews?.length ?? 0}</td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(cycle.status)}`}>{cycle.status.replaceAll("_", " ")}</span></td>
                      <td className="px-4 py-4 text-right"><button type="button" aria-label={`Select ${cycle.name}`} onClick={() => { setSelectedCycleId(cycle.id); setSelectedReviewId(""); setError(""); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><ChevronDown className={`size-4 transition ${selectedCycleId === cycle.id ? "rotate-180" : "-rotate-90"}`} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {cycles.map((cycle) => (
                <button key={cycle.id} type="button" onClick={() => { setSelectedCycleId(cycle.id); setSelectedReviewId(""); setError(""); }} className={`w-full border-l-2 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${selectedCycleId === cycle.id ? "border-l-primary bg-primary/[0.06]" : "border-l-transparent"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{cycle.name}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(cycle.status)}`}>{cycle.status.replaceAll("_", " ")}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{dateLabel(cycle.startDate)} – {dateLabel(cycle.endDate)}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{cycle.reviews?.length ?? 0} assigned reviews</span>
                    <ChevronDown className={`size-4 transition ${selectedCycleId === cycle.id ? "rotate-180" : "-rotate-90"}`} />
                  </div>
                </button>
              ))}
            </div>
            </>
          )}
        </section>

        <section className="min-w-0 space-y-3">
          {!selectedCycle ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <ClipboardCheck className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">Select a review cycle</p>
              <p className="mt-1 text-sm text-muted-foreground">Review assignments and cycle actions will appear here.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{selectedCycle.name}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(selectedCycle.status)}`}>{selectedCycle.status.replaceAll("_", " ")}</span>
                    </div>
                    {selectedCycle.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selectedCycle.description}</p>}
                    <p className="mt-2 text-sm text-muted-foreground">{dateLabel(selectedCycle.startDate)} – {dateLabel(selectedCycle.endDate)}</p>
                  </div>
                  {isManager && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {selectedCycle.status === "DRAFT" && (
                      <button type="button" className={buttonClass} disabled={saving} onClick={() => requestCycleStatus("OPEN")}>
                        <CheckCircle2 className="size-4" /> Open cycle
                      </button>
                    )}
                    {selectedCycle.status === "OPEN" && (
                      <button type="button" className={secondaryButtonClass} disabled={saving} onClick={() => requestCycleStatus("CLOSED")}>
                        <X className="size-4" /> Close cycle
                      </button>
                    )}
                  </div>
                  )}
                </div>
                {selectedCycle.status === "DRAFT" && (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    This cycle is a draft. Open it when assignments are ready so reviewers can complete their reviews.
                  </p>
                )}
                {selectedCycle.status === "CLOSED" && (
                  <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    This cycle is closed. Review editing is disabled by the cycle workflow.
                  </p>
                )}
              </div>

              {selectedReview ? (
                <div className="space-y-5 rounded-xl border border-border bg-card p-4 md:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supervisor review</p>
                      <h3 className="mt-1 text-lg font-semibold">{personName(selectedReview.staffProfile)}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Reviewer: {personName(selectedReview.reviewer)}</p>
                    </div>
                    <button type="button" className={secondaryButtonClass} onClick={() => setSelectedReviewId("")}>
                      <X className="size-4" /> Close
                    </button>
                  </div>

                  {!canEditReview && (
                    <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      {isManager
                        ? "HR can monitor this review, but only the assigned reviewer can edit and submit it."
                        : selectedReview.reviewerId !== currentUserId
                          ? "Only the assigned reviewer can edit this review."
                          : "This review is read-only because the cycle is not open or the review has already been submitted."}
                    </p>
                  )}

                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium">Overall rating</span>
                    <select className={inputClass} value={editor.overallRating} disabled={!canEditReview || saving} onChange={(e) => setEditor((current) => ({ ...current, overallRating: e.target.value }))}>
                      <option value="">Select rating</option>
                      <option value="1">1 — Needs significant improvement</option>
                      <option value="2">2 — Developing</option>
                      <option value="3">3 — Meets expectations</option>
                      <option value="4">4 — Exceeds expectations</option>
                      <option value="5">5 — Outstanding</option>
                    </select>
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium">Strengths</span>
                      <textarea className={textAreaClass} value={editor.strengths} disabled={!canEditReview || saving} onChange={(e) => setEditor((current) => ({ ...current, strengths: e.target.value }))} maxLength={8000} placeholder="Document strengths and positive contributions." />
                    </label>
                    <label className="space-y-1.5 text-sm">
                      <span className="font-medium">Areas for improvement</span>
                      <textarea className={textAreaClass} value={editor.improvementAreas} disabled={!canEditReview || saving} onChange={(e) => setEditor((current) => ({ ...current, improvementAreas: e.target.value }))} maxLength={8000} placeholder="Describe specific growth opportunities." />
                    </label>
                  </div>
                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium">Supervisor comments</span>
                    <textarea className={textAreaClass} value={editor.reviewerComments} disabled={!canEditReview || saving} onChange={(e) => setEditor((current) => ({ ...current, reviewerComments: e.target.value }))} maxLength={8000} placeholder="Summarize performance and agreed next steps." />
                  </label>

                  <div className="space-y-3">
                    {competencyFrameworks.length > 0 && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <label className="block space-y-1.5 text-sm">
                          <span className="font-medium">Approved competency framework</span>
                          <select
                            className={inputClass}
                            value={selectedFrameworkId}
                            disabled={!canEditReview || saving}
                            onChange={(event) => setSelectedFrameworkId(event.target.value)}
                          >
                            <option value="">Choose a framework…</option>
                            {competencyFrameworks.map((framework) => (
                              <option key={framework.id} value={framework.id}>
                                {framework.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Applying a framework replaces the competency rows currently in this draft.
                          Existing rows remain unchanged until you apply one.
                        </p>
                        {canEditReview && (
                          <button
                            type="button"
                            className={`${secondaryButtonClass} mt-3`}
                            disabled={saving || !selectedFrameworkId}
                            onClick={applyCompetencyFramework}
                          >
                            Apply framework
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-semibold">Competency ratings</h4>
                        <p className="mt-1 text-sm text-muted-foreground">Rate each competency from 1 to 5 and record supporting evidence.</p>
                      </div>
                      {canEditReview && (
                        <button type="button" className={secondaryButtonClass} onClick={() => setEditor((current) => ({ ...current, competencies: [...current.competencies, { competency: "", rating: 3, evidence: "" }] }))}>
                          <Plus className="size-4" /> Add competency
                        </button>
                      )}
                    </div>
                    {editor.competencies.map((competency, index) => (
                      <div key={index} className="space-y-3 rounded-lg border border-border p-3">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                          <label className="space-y-1.5 text-sm">
                            <span className="font-medium">Competency</span>
                            <input className={inputClass} value={competency.competency} disabled={!canEditReview || saving || Boolean(competency.frameworkCompetencyId)} onChange={(e) => updateCompetency(index, "competency", e.target.value)} maxLength={120} placeholder="e.g. Classroom management" />
                          </label>
                          <label className="space-y-1.5 text-sm">
                            <span className="font-medium">Rating</span>
                            <select className={inputClass} value={String(competency.rating)} disabled={!canEditReview || saving} onChange={(e) => updateCompetency(index, "rating", Number(e.target.value))}>
                              {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}
                            </select>
                          </label>
                          {canEditReview && (
                            <div className="flex items-end">
                              <button type="button" className={secondaryButtonClass} disabled={editor.competencies.length === 1} onClick={() => setEditor((current) => ({ ...current, competencies: current.competencies.filter((_, i) => i !== index) }))} aria-label={`Remove competency ${index + 1}`}>
                                <X className="size-4" /> Remove
                              </button>
                            </div>
                          )}
                        </div>
                        {(() => {
                          const definition = competency.frameworkCompetencyId
                            ? competencyFrameworks
                                .flatMap((framework) => framework.competencies)
                                .find((item) => item.id === competency.frameworkCompetencyId)
                            : null;
                          const criteria = definition
                            ? [
                                definition.rating1Criteria,
                                definition.rating2Criteria,
                                definition.rating3Criteria,
                                definition.rating4Criteria,
                                definition.rating5Criteria,
                              ][competency.rating - 1]
                            : competency.ratingCriteriaSnapshot
                              ? [
                                  competency.ratingCriteriaSnapshot.rating1Criteria,
                                  competency.ratingCriteriaSnapshot.rating2Criteria,
                                  competency.ratingCriteriaSnapshot.rating3Criteria,
                                  competency.ratingCriteriaSnapshot.rating4Criteria,
                                  competency.ratingCriteriaSnapshot.rating5Criteria,
                                ][competency.rating - 1]
                              : null;
                          const description = definition?.description ?? competency.descriptionSnapshot;
                          return (criteria || description) ? (
                            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                              {description && <p className="text-muted-foreground">{description}</p>}
                              {criteria && (
                                <p className="mt-1">
                                  <span className="font-medium">Rating {competency.rating} criteria: </span>
                                  {criteria}
                                </p>
                              )}
                            </div>
                          ) : null;
                        })()}
                        <label className="block space-y-1.5 text-sm">
                          <span className="font-medium">Evidence / examples</span>
                          <textarea className="min-h-16 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60" value={competency.evidence} disabled={!canEditReview || saving} onChange={(e) => updateCompetency(index, "evidence", e.target.value)} maxLength={4000} placeholder="Add observations or examples supporting the rating." />
                        </label>
                      </div>
                    ))}
                  </div>

                  {selectedReview.employeeComments && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-sm font-semibold">Employee comments</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selectedReview.employeeComments}</p>
                    </div>
                  )}

                  {canEditReview && (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                      <button type="button" className={secondaryButtonClass} disabled={saving} onClick={() => void saveReview("save")}>
                        {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft
                      </button>
                      <button type="button" className={buttonClass} disabled={saving} onClick={() => setConfirmation({
                        title: "Submit performance review?",
                        description: "Submitting finalizes this review. You will not be able to edit it afterward. Check the overall rating, competency evidence, strengths, and improvement areas before continuing.",
                        confirmLabel: "Submit review",
                        onConfirm: () => {
                          setConfirmation(null);
                          void saveReview("submit");
                        },
                      })}>
                        {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} Submit review
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
                  <div className="border-b border-border bg-muted/20 px-4 py-4 md:px-5">
                    <h3 className="text-sm font-semibold tracking-tight">Assigned reviews</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Open a review to view its details or edit a draft.</p>
                  </div>
                  {!selectedCycle.reviews?.length ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">No employee reviews are assigned to this cycle.</div>
                  ) : (
                    <>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-5 py-3 font-medium">Employee</th>
                            <th className="px-4 py-3 font-medium">Reviewer</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Rating</th>
                            <th className="px-4 py-3 font-medium">Acknowledged</th>
                            <th className="px-4 py-3 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {selectedCycle.reviews.map((review) => (
                            <tr key={review.id} className="transition-colors hover:bg-muted/20">
                              <td className="px-5 py-4 font-medium">{personName(review.staffProfile)}</td>
                              <td className="px-4 py-4 text-muted-foreground">{personName(review.reviewer)}</td>
                              <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(review.status)}`}>{review.status.replaceAll("_", " ")}</span></td>
                              <td className="px-4 py-4">{review.overallRating != null ? <span className="inline-flex items-center gap-1 tabular-nums"><Star className="size-3 text-amber-500" /> {review.overallRating}/5</span> : <span className="text-muted-foreground">—</span>}</td>
                              <td className="px-4 py-4 text-muted-foreground">{review.acknowledgedAt ? dateLabel(review.acknowledgedAt) : "—"}</td>
                              <td className="px-4 py-4"><button type="button" className={secondaryButtonClass} disabled={saving} onClick={() => void openReview(review.id)}><ClipboardCheck className="size-4" /> View</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="divide-y divide-border md:hidden">
                      {selectedCycle.reviews.map((review) => (
                        <div key={review.id} className="space-y-3 px-4 py-4 transition-colors hover:bg-muted/20">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium">{personName(review.staffProfile)}</p>
                              <p className="mt-1 text-sm text-muted-foreground">Reviewer: {personName(review.reviewer)}</p>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(review.status)}`}>{review.status.replaceAll("_", " ")}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {review.overallRating != null && <span className="inline-flex items-center gap-1"><Star className="size-3" /> {review.overallRating}/5 overall</span>}
                            {review.acknowledgedAt && <span>Acknowledged {dateLabel(review.acknowledgedAt)}</span>}
                          </div>
                          <button type="button" className={secondaryButtonClass} disabled={saving} onClick={() => void openReview(review.id)}><ClipboardCheck className="size-4" /> View review</button>
                        </div>
                      ))}
                    </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {isManager && <StaffPerformanceAnalytics schoolId={schoolId} />}

      <StaffPerformanceGoals
        schoolId={schoolId}
        employees={employees}
        isManager={isManager}
      />

      {isManager && (
        <StaffPerformanceCompetencyFrameworks schoolId={schoolId} />
      )}

      {isManager && showCreateForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-transparent p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setShowCreateForm(false);
          }}
        >
        <form onSubmit={createCycle} aria-labelledby="create-performance-cycle-title" className="my-auto max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <ClipboardCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Performance management</p>
                <h2 id="create-performance-cycle-title" className="mt-1.5 text-lg font-semibold tracking-tight">Create review cycle</h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Define the review period and assign employees to eligible supervisors.
                </p>
              </div>
            </div>
            <button type="button" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50" onClick={() => setShowCreateForm(false)} disabled={saving} aria-label="Close create review cycle dialog">
              <span aria-hidden="true" className="text-xl leading-none">×</span>
            </button>
          </div>
          <div className="space-y-6 px-5 py-5 sm:px-6">
          <section className="space-y-4 rounded-xl border border-border p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-semibold">Cycle details</h3>
              <p className="mt-1 text-sm text-muted-foreground">Set the review period and explain its purpose.</p>
            </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 text-sm md:col-span-2">
              <span className="font-medium">Cycle name *</span>
              <input className={inputClass} value={cycleName} onChange={(e) => setCycleName(e.target.value)} required maxLength={160} placeholder="e.g. Term 1 Performance Review" />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Start date *</span>
              <input className={inputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">End date *</span>
              <input className={inputClass} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} required />
            </label>
            <label className="space-y-1.5 text-sm md:col-span-2 xl:col-span-4">
              <span className="font-medium">Description</span>
              <textarea className={textAreaClass} value={cycleDescription} onChange={(e) => setCycleDescription(e.target.value)} maxLength={4000} placeholder="Purpose, expectations, or instructions for this review cycle." />
            </label>
          </div>

          </section>
          <section className="space-y-3 rounded-xl border border-border p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Employee assignments</h3>
                <p className="mt-1 text-sm text-muted-foreground">Pair each employee with the supervisor responsible for their review.</p>
              </div>
              <button type="button" className={secondaryButtonClass} onClick={() => setAssignments((current) => [...current, { staffProfileId: "", reviewerId: "" }])}>
                <Plus className="size-4" /> Add assignment
              </button>
            </div>
            {assignments.map((assignment, index) => (
              <div key={index} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_1fr_auto]">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Employee *</span>
                  <select className={inputClass} value={assignment.staffProfileId} onChange={(e) => updateAssignment(index, "staffProfileId", e.target.value)} required>
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {personName(employee)}{employee.staffNumber ? ` · ${employee.staffNumber}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium">Supervisor / reviewer *</span>
                  <select className={inputClass} value={assignment.reviewerId} onChange={(e) => updateAssignment(index, "reviewerId", e.target.value)} required>
                    <option value="">Select reviewer</option>
                    {reviewers.map((reviewer) => (
                      <option
                      key={reviewer.id}
                      value={reviewer.id}
                      disabled={Boolean(
                        employees.find((employee) => employee.id === assignment.staffProfileId)?.userId &&
                        employees.find((employee) => employee.id === assignment.staffProfileId)?.userId === reviewer.id
                      )}
                    >
                      {personName(reviewer)}
                      {employees.find((employee) => employee.id === assignment.staffProfileId)?.userId === reviewer.id
                        ? " (self-review not allowed)"
                        : ""}
                    </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button type="button" className={secondaryButtonClass} disabled={assignments.length === 1} onClick={() => setAssignments((current) => current.filter((_, i) => i !== index))} aria-label={`Remove assignment ${index + 1}`}>
                    <X className="size-4" /> Remove
                  </button>
                </div>
              </div>
            ))}
            {employees.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No eligible active employees were returned for this school.</p>
            )}
            {reviewers.length === 0 && !loading && (
              <p className="text-sm text-amber-700">No eligible reviewers were returned. Check active school memberships and reviewer roles.</p>
            )}
          </section>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-muted-foreground">Review the cycle dates and assignments before creating it.</p>
            <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setShowCreateForm(false)} disabled={saving}>Cancel</button>
            <button type="submit" className={buttonClass} disabled={saving || loading || employees.length === 0 || reviewers.length === 0}>
              {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {saving ? "Creating cycle…" : "Create cycle"}
            </button>
            </div>
          </div>
        </form>
        </div>
      )}


      {confirmation && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-transparent p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setConfirmation(null);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="performance-confirmation-title"
            aria-describedby="performance-confirmation-description"
            className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
              <div className="flex min-w-0 items-start gap-3.5">
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl border ${confirmation.destructive ? "border-red-500/20 bg-red-500/10 text-red-600" : "border-primary/20 bg-primary/10 text-primary"}`}>
                  {confirmation.destructive ? <AlertTriangle className="size-5" /> : <ClipboardCheck className="size-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Performance management</p>
                  <h2 id="performance-confirmation-title" className="mt-1.5 text-lg font-semibold tracking-tight">{confirmation.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">Review the selected record and expected effect before confirming.</p>
                </div>
              </div>
              <button type="button" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50" disabled={saving} onClick={() => setConfirmation(null)} aria-label="Close confirmation dialog">
                <span aria-hidden="true" className="text-xl leading-none">×</span>
              </button>
            </div>
            <div className="space-y-5 px-5 py-5 sm:px-6">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Selected record</p>
                <p className="mt-1.5 break-words text-sm font-semibold">
                  {selectedReview
                    ? personName(selectedReview.staffProfile)
                    : selectedCycle?.name ?? "Performance review"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedReview
                    ? `Reviewer: ${personName(selectedReview.reviewer)}`
                    : selectedCycle
                      ? `${dateLabel(selectedCycle.startDate)} – ${dateLabel(selectedCycle.endDate)}`
                      : "Performance review workflow"}
                </p>
                {selectedCycle && (
                  <div className="mt-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(selectedCycle.status)}`}>
                      {selectedCycle.status.replaceAll("_", " ")}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold">What this means</h3>
                <p id="performance-confirmation-description" className="mt-1.5 text-sm leading-6 text-muted-foreground">{confirmation.description}</p>
              </div>
              <div className={`rounded-xl border p-3.5 ${confirmation.destructive ? "border-red-500/25 bg-red-500/5" : "border-primary/20 bg-primary/5"}`}>
                <p className={`text-sm font-medium ${confirmation.destructive ? "text-red-700" : "text-foreground"}`}>
                  {confirmation.destructive ? "Check before proceeding" : "Ready to confirm"}
                </p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {confirmation.destructive
                    ? "Verify that this is the intended record and action before continuing."
                    : "Confirm only after checking the record and the action described above."}
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs text-muted-foreground">The action will proceed only after confirmation.</p>
              <div className="flex justify-end gap-2">
                <button type="button" className={secondaryButtonClass} disabled={saving} onClick={() => setConfirmation(null)}>Cancel</button>
                <button type="button" className={`${buttonClass} ${confirmation.destructive ? "bg-red-600 text-white hover:bg-red-700" : ""}`} disabled={saving} onClick={confirmation.onConfirm}>
                  {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  {saving ? "Processing…" : confirmation.confirmLabel}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
