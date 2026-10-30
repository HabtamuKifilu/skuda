"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Props = {
  schoolId: string;
  schoolRole: string;
  onboardingId: string;
  employeeName: string;
  completed: boolean;
};

type Workflow = {
  onboarding: {
    staffProfile: {
      employment: { employmentType: string; startDate: string | null } | null;
    };
    acknowledgements: Array<{
      id: string;
      requirementId: string;
      acknowledgedAt: string;
      notes: string | null;
      requirement: { id: string; title: string; type: string; version: string };
    }>;
    probationReviews: Array<{
      id: string;
      probationStartDate: string;
      probationEndDate: string;
      reviewDueDate: string;
      outcome: string;
      nextReviewDate: string | null;
      notes: string | null;
    }>;
    accountAccessRequests: Array<{
      id: string;
      requestedRole: string;
      status: string;
      requestNotes: string | null;
      reviewNotes: string | null;
      createdAt: string;
      requestedBy: { name: string; email: string };
      reviewedBy: { name: string; email: string } | null;
    }>;
  };
  onboardingRequirements: Array<{
    id: string;
    code: string;
    type: string;
    title: string;
    version: string;
    required: boolean;
  }>;
  documentRequirements: Array<{
    id: string;
    documentType: string;
    title: string;
    required: boolean;
    notes: string | null;
  }>;
  documents: Array<{
    id: string;
    documentType: string;
    title: string;
    reviewStatus: string;
    expiryDate: string | null;
  }>;
};

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm";

function dateLabel(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

export function OnboardingWorkflows({
  schoolId,
  schoolRole,
  onboardingId,
  employeeName,
  completed,
}: Props) {
  const base = `/api/schools/${encodeURIComponent(schoolId)}/onboarding`;
  const workflowUrl = `${base}/${encodeURIComponent(onboardingId)}/workflows`;
  const canConfigure = ["OWNER", "ADMIN", "HR_MANAGER"].includes(schoolRole);
  const canApprove = ["OWNER", "ADMIN"].includes(schoolRole);

  const [data, setData] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [docType, setDocType] = useState("IDENTIFICATION");
  const [docTitle, setDocTitle] = useState("");
  const [requirementType, setRequirementType] = useState("ORIENTATION");
  const [requirementCode, setRequirementCode] = useState("");
  const [requirementTitle, setRequirementTitle] = useState("");

  const [requestRole, setRequestRole] = useState("TEACHER");
  const [requestNotes, setRequestNotes] = useState("");

  const [probationStart, setProbationStart] = useState("");
  const [probationEnd, setProbationEnd] = useState("");
  const [reviewDue, setReviewDue] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [nextDates, setNextDates] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(workflowUrl, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to load workflows.");
      setData(result as Workflow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load workflows.");
    } finally {
      setLoading(false);
    }
  }, [workflowUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function postWorkflow(payload: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(workflowUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to update workflow.");
      setNotice("Workflow updated.");
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update workflow.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveRequirement(
    event: FormEvent<HTMLFormElement>,
    payload: Record<string, unknown>,
  ) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${base}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to save requirement.");
      setNotice("Requirement saved.");
      if (payload.kind === "document") setDocTitle("");
      if (payload.kind === "onboarding") {
        setRequirementCode("");
        setRequirementTitle("");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save requirement.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewAccess(id: string, decision: "APPROVED" | "REJECTED") {
    if (!canApprove) return;
    const notes = window.prompt(
      decision === "REJECTED" ? "Reason for rejection (required):" : "Review notes (optional):",
      "",
    );
    if (notes === null) return;
    if (decision === "REJECTED" && !notes.trim()) {
      setError("A rejection reason is required.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${base}/access-requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNotes: notes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to review access request.");
      setNotice(decision === "APPROVED" ? "Access approved and role assigned." : "Access request rejected.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review access request.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return <section className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Loading onboarding workflows…</section>;
  }

  return (
    <section className="space-y-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">Requirements and onboarding workflows</h4>
        <button type="button" onClick={() => void refresh()} disabled={loading || saving} className="rounded-lg border border-input px-3 py-2 text-xs font-medium disabled:opacity-60">
          Refresh workflows
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-primary/20 p-3 text-sm">{notice}</p>}

      {!data ? (
        <p className="text-sm text-muted-foreground">Workflow details could not be loaded. Use Refresh workflows to retry.</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3 rounded-lg border border-border p-4">
              <h5 className="font-semibold">Required documents</h5>
              {data.documentRequirements.length ? (
                <ul className="space-y-3">
                  {data.documentRequirements.map((requirement) => {
                    const docs = data.documents.filter((doc) => doc.documentType === requirement.documentType);
                    return (
                      <li key={requirement.id}>
                        <p className="font-medium">{requirement.title}</p>
                        <p className="text-xs text-muted-foreground">{requirement.documentType.replaceAll("_", " ")} · {requirement.required ? "Required" : "Optional"}</p>
                        <p className="text-xs text-muted-foreground">
                          {docs.length
                            ? docs.map((doc) => `${doc.title}: ${doc.reviewStatus}${doc.expiryDate ? ` · expires ${dateLabel(doc.expiryDate)}` : ""}`).join("; ")
                            : "No document uploaded"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No active document requirements configured.</p>}

              {canConfigure && !completed && (
                <form className="space-y-2 border-t border-border pt-3" onSubmit={(event) => void saveRequirement(event, {
                  kind: "document", documentType: docType, title: docTitle, required: true, isActive: true,
                })}>
                  <p className="text-xs font-medium text-muted-foreground">Add or update a required document rule</p>
                  <select value={docType} onChange={(event) => setDocType(event.target.value)} className={inputClass} disabled={saving}>
                    <option value="EMPLOYMENT_CONTRACT">Employment contract</option>
                    <option value="IDENTIFICATION">Identification</option>
                    <option value="EDUCATIONAL_CERTIFICATE">Educational certificate</option>
                    <option value="EXPERIENCE_LETTER">Experience letter</option>
                    <option value="PROFESSIONAL_CERTIFICATE">Professional certificate</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <input required maxLength={160} value={docTitle} onChange={(event) => setDocTitle(event.target.value)} placeholder="Requirement title" className={inputClass} disabled={saving} />
                  <button type="submit" disabled={saving || !docTitle.trim()} className="rounded-lg border border-input px-3 py-2 text-xs font-medium disabled:opacity-60">Save document rule</button>
                </form>
              )}
            </section>

            <section className="space-y-3 rounded-lg border border-border p-4">
              <h5 className="font-semibold">Orientation and policy acknowledgements</h5>
              {data.onboardingRequirements.length ? (
                <ul className="space-y-3">
                  {data.onboardingRequirements.map((requirement) => {
                    const acknowledgement = data.onboarding.acknowledgements.find((entry) => entry.requirementId === requirement.id);
                    return (
                      <li key={requirement.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0">
                        <div>
                          <p className="font-medium">{requirement.title}</p>
                          <p className="text-xs text-muted-foreground">{requirement.type.replaceAll("_", " ")} · v{requirement.version} · {requirement.required ? "Required" : "Optional"}</p>
                          {acknowledgement && <p className="text-xs text-muted-foreground">Recorded {dateLabel(acknowledgement.acknowledgedAt)}</p>}
                        </div>
                        {!acknowledgement && !completed && (
                          <button type="button" disabled={saving} onClick={() => {
                            if (window.confirm(`Confirm ${employeeName} has completed or acknowledged “${requirement.title}”? This records the administrator's entry, not an electronic signature.`)) {
                              void postWorkflow({ action: "acknowledge", requirementId: requirement.id, notes: "Recorded by authorized school staff after confirmation." });
                            }
                          }} className="shrink-0 rounded-lg border border-input px-3 py-2 text-xs font-medium disabled:opacity-60">
                            Record acknowledgement
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No active acknowledgement requirements configured.</p>}

              {canConfigure && !completed && (
                <form className="space-y-2 border-t border-border pt-3" onSubmit={(event) => {
                  void saveRequirement(event, {
                    kind: "onboarding", code: requirementCode, title: requirementTitle,
                    type: requirementType, version: "1", required: true, isActive: true,
                  });
                }}>
                  <p className="text-xs font-medium text-muted-foreground">Add or update an acknowledgement rule</p>
                  <select value={requirementType} onChange={(event) => setRequirementType(event.target.value)} className={inputClass} disabled={saving}>
                    <option value="ORIENTATION">Orientation</option>
                    <option value="POLICY_ACKNOWLEDGEMENT">Policy acknowledgement</option>
                  </select>
                  <input required maxLength={80} pattern="[A-Za-z0-9_-]+" value={requirementCode} onChange={(event) => setRequirementCode(event.target.value)} placeholder="Unique code, e.g. STAFF_CONDUCT" className={inputClass} disabled={saving} />
                  <input required maxLength={160} value={requirementTitle} onChange={(event) => setRequirementTitle(event.target.value)} placeholder="Requirement title" className={inputClass} disabled={saving} />
                  <button type="submit" disabled={saving || !requirementCode.trim() || !requirementTitle.trim()} className="rounded-lg border border-input px-3 py-2 text-xs font-medium disabled:opacity-60">Save acknowledgement rule</button>
                </form>
              )}
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3 rounded-lg border border-border p-4">
              <h5 className="font-semibold">Probation reviews</h5>
              {data.onboarding.staffProfile.employment?.employmentType !== "PROBATION" && (
                <p className="text-sm text-muted-foreground">Set the employee's employment type to PROBATION before scheduling reviews.</p>
              )}
              {data.onboarding.probationReviews.map((review) => (
                <div key={review.id} className="space-y-2 rounded-lg bg-muted/40 p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">Due {dateLabel(review.reviewDueDate)}</span>
                    <span className="text-xs text-muted-foreground">{review.outcome}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Probation {dateLabel(review.probationStartDate)} – {dateLabel(review.probationEndDate)}</p>
                  {review.notes && <p className="text-sm">{review.notes}</p>}
                  {review.outcome === "PENDING" && !completed && (
                    <div className="space-y-2">
                      <select value={outcomes[review.id] || "PASSED"} onChange={(event) => setOutcomes((current) => ({ ...current, [review.id]: event.target.value }))} className={inputClass} disabled={saving}>
                        <option value="PASSED">Passed</option>
                        <option value="EXTENDED">Extended</option>
                        <option value="FAILED">Failed</option>
                      </select>
                      {(outcomes[review.id] || "PASSED") === "EXTENDED" && (
                        <input type="date" required value={nextDates[review.id] || ""} onChange={(event) => setNextDates((current) => ({ ...current, [review.id]: event.target.value }))} className={inputClass} disabled={saving} />
                      )}
                      <textarea rows={2} maxLength={2000} value={reviewNotes[review.id] || ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [review.id]: event.target.value }))} placeholder="Review notes" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" disabled={saving} />
                      <button type="button" disabled={saving || ((outcomes[review.id] || "PASSED") === "EXTENDED" && !nextDates[review.id])} onClick={() => void postWorkflow({
                        action: "submit-probation-review", reviewId: review.id,
                        outcome: outcomes[review.id] || "PASSED",
                        nextReviewDate: nextDates[review.id] || null,
                        notes: reviewNotes[review.id] || null,
                      })} className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">Save review outcome</button>
                    </div>
                  )}
                </div>
              ))}
              {!data.onboarding.probationReviews.length && <p className="text-sm text-muted-foreground">No probation reviews scheduled.</p>}

              {data.onboarding.staffProfile.employment?.employmentType === "PROBATION" && !completed && (
                <form className="space-y-2 border-t border-border pt-3" onSubmit={(event) => {
                  event.preventDefault();
                  void postWorkflow({
                    action: "schedule-probation-review",
                    probationStartDate: probationStart,
                    probationEndDate: probationEnd,
                    reviewDueDate: reviewDue,
                    notes: null,
                  });
                }}>
                  <p className="text-xs font-medium text-muted-foreground">Schedule a probation review</p>
                  <label className="block space-y-1"><span>Probation start</span><input required type="date" value={probationStart} onChange={(event) => setProbationStart(event.target.value)} className={inputClass} disabled={saving} /></label>
                  <label className="block space-y-1"><span>Probation end</span><input required type="date" min={probationStart || undefined} value={probationEnd} onChange={(event) => setProbationEnd(event.target.value)} className={inputClass} disabled={saving} /></label>
                  <label className="block space-y-1"><span>Review due</span><input required type="date" min={probationStart || undefined} max={probationEnd || undefined} value={reviewDue} onChange={(event) => setReviewDue(event.target.value)} className={inputClass} disabled={saving} /></label>
                  <button type="submit" disabled={saving || !probationStart || !probationEnd || !reviewDue} className="rounded-lg border border-input px-3 py-2 text-xs font-medium disabled:opacity-60">Schedule review</button>
                </form>
              )}
            </section>

            <section className="space-y-3 rounded-lg border border-border p-4">
              <h5 className="font-semibold">Account access requests</h5>
              {data.onboarding.accountAccessRequests.map((access) => (
                <div key={access.id} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{access.requestedRole.replaceAll("_", " ")}</span>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs">{access.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Requested by {access.requestedBy.name} · {dateLabel(access.createdAt)}</p>
                  {access.requestNotes && <p className="text-sm">{access.requestNotes}</p>}
                  {access.reviewNotes && <p className="text-sm text-muted-foreground">Review: {access.reviewNotes}</p>}
                  {access.status === "PENDING" && canApprove && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={saving} onClick={() => void reviewAccess(access.id, "APPROVED")} className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60">Approve and assign role</button>
                      <button type="button" disabled={saving} onClick={() => void reviewAccess(access.id, "REJECTED")} className="rounded-lg border border-input px-3 py-2 text-xs font-medium disabled:opacity-60">Reject</button>
                    </div>
                  )}
                </div>
              ))}
              {!data.onboarding.accountAccessRequests.length && <p className="text-sm text-muted-foreground">No account-access requests.</p>}

              {!completed && (
                <form className="space-y-2 border-t border-border pt-3" onSubmit={(event) => {
                  event.preventDefault();
                  void postWorkflow({ action: "request-account-access", role: requestRole, notes: requestNotes || null }).then((success) => {
                    if (success) setRequestNotes("");
                  });
                }}>
                  <p className="text-xs font-medium text-muted-foreground">Request a school account role</p>
                  <select value={requestRole} onChange={(event) => setRequestRole(event.target.value)} className={inputClass} disabled={saving}>
                    <option value="TEACHER">Teacher</option>
                    <option value="ACADEMIC_HEAD">Academic head</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="REGISTRAR">Registrar</option>
                    <option value="HR_MANAGER">HR manager</option>
                  </select>
                  <textarea rows={2} maxLength={2000} value={requestNotes} onChange={(event) => setRequestNotes(event.target.value)} placeholder="Why is this access needed?" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" disabled={saving} />
                  <button type="submit" disabled={saving} className="rounded-lg border border-input px-3 py-2 text-xs font-medium disabled:opacity-60">Request access</button>
                </form>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
