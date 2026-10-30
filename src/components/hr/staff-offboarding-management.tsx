"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";

type StaffMember = {
  id: string;
  employeeNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
  status: string;
};

type OffboardingWorkflowData = {
  tasks: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    required: boolean;
    dueDate: string | null;
    evidenceRef: string | null;
    exceptionReason: string | null;
    documents: Array<{
      id: string;
      originalFileName: string;
      contentType: string;
      sizeBytes: number;
      uploadedById: string;
      createdAt: string;
    }>;
  }>;
  revocations: Array<{
    id: string;
    accessType: string;
    target: string;
    status: string;
    required: boolean;
    verifiedAt: string | null;
    outcomeNotes: string | null;
  }>;
  settlement: {
    id: string;
    status: string;
    currency: string;
    paymentDate: string | null;
    paymentReference: string | null;
    paymentEvidenceRef: string | null;
    employeeAcknowledged: boolean;
    items: Array<{
      id: string;
      itemType: string;
      description: string;
      amount: string | number;
      currency: string;
    }>;
  } | null;
};

type OffboardingRecord = {
  id: string;
  staffProfileId: string;
  exitType: string;
  initiator: string;
  status: string;
  reasonCategory: string | null;
  reasonNotes: string | null;
  noticeRequired: boolean;
  noticeGiven: boolean;
  noticeDate: string | null;
  proposedLastDay: string | null;
  confirmedLastDay: string | null;
  effectiveTerminationDate: string | null;
  disputePending: boolean;
  investigationPending: boolean;
  exitInterviewCompleted: boolean;
  handoverConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
  staffProfile: StaffMember;
};

const exitTypes = [
  ["RESIGNATION", "Resignation"],
  ["RETIREMENT", "Retirement"],
  ["FIXED_TERM_END", "Fixed-term contract end"],
  ["REDUNDANCY", "Redundancy"],
  ["DISMISSAL", "Dismissal"],
  ["PROBATION_TERMINATION", "Probation termination"],
  ["MUTUAL_AGREEMENT", "Mutual agreement"],
  ["DEATH", "Death"],
  ["OTHER", "Other"],
] as const;

const statuses = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "COMPLETED",
] as const;

const inputClass =
  "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-60";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
const panelClass = "rounded-2xl border border-border bg-card shadow-sm";

function employeeName(staff: StaffMember) {
  return [staff.firstName, staff.middleName, staff.lastName]
    .filter(Boolean)
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function label(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClasses(status: string) {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "APPROVED":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "REJECTED":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    case "UNDER_REVIEW":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function StaffOffboardingManagement({
  schoolId,
  schoolRole,
}: {
  schoolId: string;
  schoolRole: string;
}) {
  const canReviewTasks = schoolRole === "OWNER" || schoolRole === "ADMIN";
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<OffboardingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [actionRecord, setActionRecord] = useState<OffboardingRecord | null>(null);
  const [actionType, setActionType] = useState("");
  const [actionDate, setActionDate] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [exitType, setExitType] = useState("RESIGNATION");
  const [initiator, setInitiator] = useState("EMPLOYEE");
  const [reasonCategory, setReasonCategory] = useState("");
  const [reasonNotes, setReasonNotes] = useState("");
  const [confidentialNotes, setConfidentialNotes] = useState("");
  const [noticeRequired, setNoticeRequired] = useState(false);
  const [noticeGiven, setNoticeGiven] = useState(false);
  const [noticeDate, setNoticeDate] = useState("");
  const [proposedLastDay, setProposedLastDay] = useState("");
  const [disputePending, setDisputePending] = useState(false);
  const [investigationPending, setInvestigationPending] = useState(false);
  const [rehireEligible, setRehireEligible] = useState("unset");
  const [workflowRecord, setWorkflowRecord] = useState<OffboardingRecord | null>(null);
  const [workflowData, setWorkflowData] = useState<OffboardingWorkflowData | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState("");
  const [editingTask, setEditingTask] = useState<OffboardingWorkflowData["tasks"][number] | null>(null);
  const [taskStatus, setTaskStatus] = useState("PENDING");
  const [taskEvidenceRef, setTaskEvidenceRef] = useState("");
  const [taskReviewNotes, setTaskReviewNotes] = useState("");
  const [taskExceptionReason, setTaskExceptionReason] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskDocumentFile, setTaskDocumentFile] = useState<File | null>(null);
  const [taskDocumentUploading, setTaskDocumentUploading] = useState(false);
  const [previewTaskDocument, setPreviewTaskDocument] = useState<{
    id: string;
    taskId: string;
    originalFileName: string;
  } | null>(null);
  const [previewTaskDocumentLoading, setPreviewTaskDocumentLoading] = useState(false);

  useEffect(() => {
    if (!previewTaskDocument) {
      setPreviewTaskDocumentLoading(false);
      return;
    }

    setPreviewTaskDocumentLoading(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewTaskDocument(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewTaskDocument]);
  const [editingRevocation, setEditingRevocation] = useState<OffboardingWorkflowData["revocations"][number] | null>(null);
  const [revocationStatus, setRevocationStatus] = useState("PENDING");
  const [revocationNotes, setRevocationNotes] = useState("");
  const [revocationReference, setRevocationReference] = useState("");
  const [revocationSaving, setRevocationSaving] = useState(false);

  const [editingSettlementItem, setEditingSettlementItem] = useState<OffboardingWorkflowData["settlement"] extends infer S ? S extends { items: Array<infer I> } ? I | null : never : never>(null);
  const [settlementItemType, setSettlementItemType] = useState("FINAL_SALARY");
  const [settlementItemDescription, setSettlementItemDescription] = useState("");
  const [settlementItemAmount, setSettlementItemAmount] = useState("");
  const [settlementItemNotes, setSettlementItemNotes] = useState("");
  const [settlementItemReference, setSettlementItemReference] = useState("");
  const [settlementItemSaving, setSettlementItemSaving] = useState(false);
  const [settlementAction, setSettlementAction] = useState("submit_for_review");
  const [settlementPaymentDate, setSettlementPaymentDate] = useState("");
  const [settlementPaymentReference, setSettlementPaymentReference] = useState("");
  const [settlementPaymentEvidence, setSettlementPaymentEvidence] = useState("");
  const [settlementAcknowledgmentRef, setSettlementAcknowledgmentRef] = useState("");
  const [settlementActionNotes, setSettlementActionNotes] = useState("");
  const [settlementActionSaving, setSettlementActionSaving] = useState(false);




  const apiBase = `/api/schools/${encodeURIComponent(schoolId)}`;

  const loadData = useCallback(async (initial = false) => {
    try {
      const [staffResponse, recordsResponse] = await Promise.all([
        fetch(`${apiBase}/staff?page=1&pageSize=100`, { cache: "no-store" }),
        fetch(`${apiBase}/offboarding`, { cache: "no-store" }),
      ]);
      const [staffData, recordsData] = await Promise.all([
        staffResponse.json(),
        recordsResponse.json(),
      ]);
      if (!staffResponse.ok) {
        throw new Error(staffData.error || "Unable to load the staff directory.");
      }
      if (!recordsResponse.ok) {
        throw new Error(recordsData.error || "Unable to load offboarding records.");
      }
      setError("");
      setStaff(Array.isArray(staffData.staff) ? staffData.staff : []);
      setRecords(Array.isArray(recordsData.records) ? recordsData.records : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load offboarding data.");
    } finally {
      if (initial) setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const status of statuses) result[status] = 0;
    for (const record of records) result[record.status] = (result[record.status] ?? 0) + 1;
    return result;
  }, [records]);

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (statusFilter !== "ALL" && record.status !== statusFilter) return false;
      if (!query) return true;
      const staffMember = record.staffProfile;
      return [
        employeeName(staffMember),
        staffMember.employeeNumber,
        staffMember.jobTitle ?? "",
        staffMember.department ?? "",
        record.exitType,
        record.status,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [records, search, statusFilter]);

  const eligibleStaff = useMemo(() => {
    const activeCaseStaff = new Set(
      records
        .filter((record) =>
          ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(record.status),
        )
        .map((record) => record.staffProfileId),
    );
    return staff.filter(
      (member) => member.status !== "TERMINATED" && !activeCaseStaff.has(member.id),
    );
  }, [records, staff]);

  async function readError(response: Response, fallback: string) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const issues =
        data.issues && typeof data.issues === "object"
          ? Object.entries(data.issues as Record<string, unknown>)
              .map(([field, message]) => {
                const detail =
                  typeof message === "string" ? message : "Invalid value.";
                return `${field}: ${detail}`;
              })
              .join(" ")
          : "";
      throw new Error(
        issues
          ? `${data.error || fallback} ${issues}`
          : data.error || fallback,
      );
    }
    return data;
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        staffProfileId: selectedStaffId,
        exitType,
        initiator,
        reasonCategory: reasonCategory.trim() || undefined,
        reasonNotes: reasonNotes.trim() || undefined,
        confidentialNotes: confidentialNotes.trim() || undefined,
        noticeRequired,
        noticeGiven,
        disputePending,
        investigationPending,
        noticeDate: noticeDate || undefined,
        proposedLastDay: proposedLastDay || undefined,
      };
      const response = await fetch(`${apiBase}/offboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await readError(response, "Unable to create the offboarding case.");
      setShowCreate(false);
      setSelectedStaffId("");
      setReasonCategory("");
      setReasonNotes("");
      setConfidentialNotes("");
      setNoticeRequired(false);
      setNoticeGiven(false);
      setNoticeDate("");
      setProposedLastDay("");
      setDisputePending(false);
      setInvestigationPending(false);
      setNotice("Offboarding case created as a draft.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the case.");
    } finally {
      setSaving(false);
    }
  }

  async function loadWorkflow(record: OffboardingRecord) {
    setWorkflowRecord(record);
    setWorkflowData(null);
    setWorkflowError("");
    setWorkflowLoading(true);
    try {
      const base = `${apiBase}/offboarding/${encodeURIComponent(record.id)}`;
      const [tasksResponse, accessResponse, settlementResponse] = await Promise.all([
        fetch(`${base}/tasks`, { cache: "no-store" }),
        fetch(`${base}/access-revocations`, { cache: "no-store" }),
        fetch(`${base}/settlement`, { cache: "no-store" }),
      ]);

      const [tasksData, accessData, settlementData] = await Promise.all([
        tasksResponse.json().catch(() => ({})),
        accessResponse.json().catch(() => ({})),
        settlementResponse.json().catch(() => ({})),
      ]);

      if (!tasksResponse.ok) throw new Error(tasksData.error || "Unable to load offboarding tasks.");
      if (!accessResponse.ok) throw new Error(accessData.error || "Unable to load access revocations.");
      if (!settlementResponse.ok && settlementResponse.status !== 404) {
        throw new Error(settlementData.error || "Unable to load final settlement.");
      }

      const rawSettlement = settlementResponse.ok ? settlementData.settlement : null;
      setWorkflowData({
        tasks: Array.isArray(tasksData.tasks)
          ? tasksData.tasks.map((task: OffboardingWorkflowData["tasks"][number]) => ({
              ...task,
              documents: Array.isArray(task.documents) ? task.documents : [],
            }))
          : [],
        revocations: Array.isArray(accessData.revocations) ? accessData.revocations : [],
        settlement: rawSettlement && typeof rawSettlement === "object"
          ? {
              id: rawSettlement.id,
              status: rawSettlement.status,
              currency: rawSettlement.currency,
              paymentDate: rawSettlement.paymentDate ?? null,
              paymentReference: rawSettlement.paymentReference ?? null,
              paymentEvidenceRef: rawSettlement.paymentEvidenceRef ?? null,
              employeeAcknowledged: Boolean(rawSettlement.employeeAcknowledged),
              items: Array.isArray(rawSettlement.items) ? rawSettlement.items : [],
            }
          : null,
      });
    } catch (caught) {
      setWorkflowError(caught instanceof Error ? caught.message : "Unable to load workflow details.");
    } finally {
      setWorkflowLoading(false);
    }
  }

  async function runSettlementAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workflowRecord || !workflowData?.settlement || settlementActionSaving) return;

    if (settlementAction === "mark_paid" &&
        (!settlementPaymentDate || !settlementPaymentReference.trim() || !settlementPaymentEvidence.trim())) {
      setWorkflowError("Payment date, payment reference, and payment evidence are required.");
      return;
    }
    if ((settlementAction === "mark_disputed" || settlementAction === "cancel") &&
        !settlementActionNotes.trim()) {
      setWorkflowError("A reason is required for this action.");
      return;
    }
    if (settlementAction === "acknowledge" && !settlementAcknowledgmentRef.trim()) {
      setWorkflowError("An employee acknowledgment reference is required.");
      return;
    }

    setSettlementActionSaving(true);
    setWorkflowError("");
    try {
      const response = await fetch(
        `${apiBase}/offboarding/${encodeURIComponent(workflowRecord.id)}/settlement/workflow`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: settlementAction,
            ...(settlementAction === "mark_paid" ? {
              paymentDate: settlementPaymentDate,
              paymentReference: settlementPaymentReference.trim(),
              paymentEvidenceRef: settlementPaymentEvidence.trim(),
            } : {}),
            ...(settlementAction === "acknowledge" ? {
              acknowledgmentRef: settlementAcknowledgmentRef.trim(),
            } : {}),
            ...(settlementAction === "mark_disputed" || settlementAction === "cancel"
              ? { notes: settlementActionNotes.trim() } : {}),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update settlement workflow.");

      setNotice("Settlement workflow updated.");
      setSettlementActionNotes("");
      setSettlementPaymentReference("");
      setSettlementPaymentEvidence("");
      setSettlementAcknowledgmentRef("");
      await loadWorkflow(workflowRecord);
    } catch (caught) {
      setWorkflowError(caught instanceof Error ? caught.message : "Unable to update settlement workflow.");
    } finally {
      setSettlementActionSaving(false);
    }
  }

  async function saveSettlementItemEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workflowRecord || !editingSettlementItem || settlementItemSaving) return;

    const amount = settlementItemAmount.trim();
    if (!/^\\d{1,12}(?:\\.\\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
      setWorkflowError("Enter a non-negative amount with up to two decimal places.");
      return;
    }
    if (!settlementItemDescription.trim()) {
      setWorkflowError("A settlement item description is required.");
      return;
    }

    setSettlementItemSaving(true);
    setWorkflowError("");
    try {
      const response = await fetch(
        `${apiBase}/offboarding/${encodeURIComponent(workflowRecord.id)}/settlement/items/${encodeURIComponent(editingSettlementItem.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemType: settlementItemType,
            description: settlementItemDescription.trim(),
            amount,
            calculationNotes: settlementItemNotes.trim(),
            reference: settlementItemReference.trim(),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update the settlement item.");

      setEditingSettlementItem(null);
      setNotice("Settlement item updated.");
      await loadWorkflow(workflowRecord);
    } catch (caught) {
      setWorkflowError(caught instanceof Error ? caught.message : "Unable to update the settlement item.");
    } finally {
      setSettlementItemSaving(false);
    }
  }

  async function saveTaskEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workflowRecord || !editingTask || taskSaving) return;

    if (taskStatus === "COMPLETED" && !taskEvidenceRef.trim()) {
      setWorkflowError("Evidence is required before completing a task.");
      return;
    }
    if (taskStatus === "WAIVED" && !taskExceptionReason.trim()) {
      setWorkflowError("An exception reason is required to waive a task.");
      return;
    }

    setTaskSaving(true);
    setWorkflowError("");
    try {
      const response = await fetch(
        `${apiBase}/offboarding/${encodeURIComponent(workflowRecord.id)}/tasks/${encodeURIComponent(editingTask.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: taskStatus,
            evidenceRef: taskEvidenceRef.trim(),
            ...(taskReviewNotes.trim()
              ? { reviewNotes: taskReviewNotes.trim() }
              : {}),
            exceptionReason: taskExceptionReason.trim(),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to update the clearance task.");
      }

      setEditingTask(null);
      setNotice("Clearance task updated.");
      await loadWorkflow(workflowRecord);
    } catch (caught) {
      setWorkflowError(caught instanceof Error ? caught.message : "Unable to update the clearance task.");
    } finally {
      setTaskSaving(false);
    }
  }

  async function uploadTaskDocument() {
    if (!workflowRecord || !editingTask || !taskDocumentFile || taskDocumentUploading) return;

    const file = taskDocumentFile;
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setWorkflowError("Choose a PDF, JPEG, or PNG document.");
      return;
    }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) {
      setWorkflowError("The document must be between 1 byte and 10 MiB.");
      return;
    }

    setTaskDocumentUploading(true);
    setWorkflowError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `${apiBase}/offboarding/${encodeURIComponent(workflowRecord.id)}/tasks/${encodeURIComponent(editingTask.id)}/documents`,
        { method: "POST", body: formData },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to upload the supporting document.");
      }

      setTaskDocumentFile(null);
      const fileInput = document.getElementById("offboarding-task-document-file");
      if (fileInput instanceof HTMLInputElement) fileInput.value = "";
      setNotice("Supporting document uploaded.");
      await loadWorkflow(workflowRecord);
    } catch (caught) {
      setWorkflowError(caught instanceof Error ? caught.message : "Unable to upload the supporting document.");
    } finally {
      setTaskDocumentUploading(false);
    }
  }

  function taskDocumentUrl(taskId: string, documentId: string, preview = false) {
    const base = `${apiBase}/offboarding/${encodeURIComponent(workflowRecord!.id)}/tasks/${encodeURIComponent(taskId)}/documents/${encodeURIComponent(documentId)}/download`;
    return preview ? `${base}?view=preview` : base;
  }

  async function saveRevocationEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workflowRecord || !editingRevocation || revocationSaving) return;
    if (["REVOKED", "NOT_APPLICABLE", "FAILED"].includes(revocationStatus) && !revocationNotes.trim()) {
      setWorkflowError("Outcome notes are required for this access status.");
      return;
    }
    setRevocationSaving(true);
    setWorkflowError("");
    try {
      const response = await fetch(
        `${apiBase}/offboarding/${encodeURIComponent(workflowRecord.id)}/access-revocations/${encodeURIComponent(editingRevocation.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: revocationStatus,
            outcomeNotes: revocationNotes.trim(),
            externalReference: revocationReference.trim(),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to update access revocation.");
      setEditingRevocation(null);
      setNotice("Access revocation outcome updated.");
      await loadWorkflow(workflowRecord);
    } catch (caught) {
      setWorkflowError(caught instanceof Error ? caught.message : "Unable to update access revocation.");
    } finally {
      setRevocationSaving(false);
    }
  }

  function openAction(record: OffboardingRecord, action: string) {
    setActionRecord(record);
    setActionType(action);
    setActionDate(record.confirmedLastDay?.slice(0, 10) ?? record.proposedLastDay?.slice(0, 10) ?? "");
    setActionReason("");
    setRehireEligible("unset");
    setError("");
    setNotice("");
  }

  async function runAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actionRecord || !actionType) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload: Record<string, string | boolean> = { action: actionType };
      if (actionType === "approve") {
        if (!actionDate) throw new Error("Enter the confirmed last working day.");
        payload.confirmedLastDay = actionDate;
        if (rehireEligible !== "unset") payload.rehireEligible = rehireEligible === "yes";
      }
      if (actionType === "reject") {
        if (actionReason.trim().length < 3) {
          throw new Error("Provide a rejection reason of at least 3 characters.");
        }
        payload.rejectionReason = actionReason.trim();
      }
      const response = await fetch(
        `${apiBase}/offboarding/${encodeURIComponent(actionRecord.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      await readError(response, `Unable to ${actionType} this case.`);
      setActionRecord(null);
      setNotice(`Case ${actionType === "complete" ? "completed" : `${actionType}d`} successfully.`);
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the case.");
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            People &amp; HR / Employment &amp; Insights
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Offboarding</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Manage employee exits through a documented review, approval and access-revocation workflow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButtonClass} onClick={() => void loadData()} disabled={loading || saving}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button type="button" className={buttonClass} onClick={() => { setError(""); setNotice(""); setShowCreate(true); }}>
            <Plus className="size-4" />
            New case
          </button>
        </div>
      </div>

      {error && !showCreate && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <p>{error}</p>
          <button type="button" className="ml-auto" aria-label="Dismiss error" onClick={() => setError("")}><X className="size-4" /></button>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-5 shrink-0" />{notice}
          <button type="button" className="ml-auto" aria-label="Dismiss message" onClick={() => setNotice("")}><X className="size-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className={`${panelClass} p-4`}>
          <div className="flex items-center justify-between text-muted-foreground"><span className="text-sm">All cases</span><ClipboardList className="size-4" /></div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{records.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Latest 100 records</p>
        </div>
        <div className={`${panelClass} p-4`}>
          <div className="flex items-center justify-between text-muted-foreground"><span className="text-sm">Awaiting review</span><ArrowDownRight className="size-4" /></div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{(counts.SUBMITTED ?? 0) + (counts.UNDER_REVIEW ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Submitted or under review</p>
        </div>
        <div className={`${panelClass} p-4`}>
          <div className="flex items-center justify-between text-muted-foreground"><span className="text-sm">Approved</span><CalendarDays className="size-4" /></div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{counts.APPROVED ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pending final completion</p>
        </div>
        <div className={`${panelClass} p-4`}>
          <div className="flex items-center justify-between text-muted-foreground"><span className="text-sm">Completed</span><CheckCircle2 className="size-4" /></div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{counts.COMPLETED ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Exit workflow completed</p>
        </div>
      </div>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold">Exit cases</h2>
            <p className="mt-1 text-xs text-muted-foreground">{visibleRecords.length} matching records</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 sm:min-w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Search offboarding cases" className={`${inputClass} pl-9`} placeholder="Search employee, ID, department…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <select aria-label="Filter by status" className={`${inputClass} sm:w-48`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All statuses</option>
              {statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 p-14 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Loading offboarding records…</div>
        ) : visibleRecords.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted"><ClipboardList className="size-6 text-muted-foreground" /></div>
            <h3 className="mt-4 font-semibold">No offboarding cases found</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Create a case to start a documented employee exit, or adjust your search and status filters.</p>
            <button type="button" className={`${secondaryButtonClass} mt-4`} onClick={() => { setSearch(""); setStatusFilter("ALL"); }}>Clear filters</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Exit type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Proposed last day</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Workflow actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRecords.map((record) => {
                  const canComplete = record.status === "APPROVED"
                    && Boolean(record.confirmedLastDay)
                    && record.confirmedLastDay!.slice(0, 10) <= today
                    && !record.disputePending
                    && !record.investigationPending;
                  return (
                    <tr key={record.id} className="align-top transition hover:bg-muted/20">
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-4" /></div>
                          <div>
                            <p className="font-semibold">{employeeName(record.staffProfile)}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{record.staffProfile.employeeNumber}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{record.staffProfile.jobTitle || "Role not set"}{record.staffProfile.department ? ` · ${record.staffProfile.department}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p>{label(record.exitType)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{label(record.initiator)} initiated</p>
                        {record.noticeRequired && <p className="mt-1 text-xs text-muted-foreground">Notice: {record.noticeGiven ? "given" : "not recorded"}</p>}
                      </td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(record.status)}`}>{label(record.status)}</span>
                        {(record.disputePending || record.investigationPending) && <p className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><ShieldAlert className="size-3.5" />{record.disputePending && record.investigationPending ? "Dispute and investigation" : record.disputePending ? "Dispute pending" : "Investigation pending"}</p>}
                      </td>
                      <td className="px-4 py-4">{formatDate(record.proposedLastDay)}{record.confirmedLastDay && <p className="mt-1 text-xs text-muted-foreground">Confirmed: {formatDate(record.confirmedLastDay)}</p>}</td>
                      <td className="px-4 py-4 text-muted-foreground">{formatDate(record.createdAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-max flex-nowrap items-center gap-1.5">
                          {record.status === "DRAFT" && <button type="button" className={secondaryButtonClass} onClick={() => openAction(record, "submit")}>Submit</button>}
                          {record.status === "SUBMITTED" && <button type="button" className={secondaryButtonClass} onClick={() => openAction(record, "review")}>Start review</button>}
                          {record.status === "UNDER_REVIEW" && <>
                            <button type="button" className={buttonClass} onClick={() => openAction(record, "approve")}>Approve</button>
                            <button type="button" className={secondaryButtonClass} onClick={() => openAction(record, "reject")}>Reject</button>
                          </>}
                          {["DRAFT", "SUBMITTED", "UNDER_REVIEW"].includes(record.status) && <button type="button" className={secondaryButtonClass} onClick={() => openAction(record, "withdraw")}>Withdraw</button>}
                          <button type="button" className={secondaryButtonClass} onClick={() => void loadWorkflow(record)}>Open workflow</button>
                          {record.status === "APPROVED" && <button type="button" className={buttonClass} disabled={!canComplete} title={!canComplete ? "Completion requires a confirmed date that has arrived and no pending dispute or investigation." : "Complete offboarding"} onClick={() => openAction(record, "complete")}>Complete</button>}
                          {["COMPLETED", "REJECTED", "WITHDRAWN"].includes(record.status) && <span className="text-xs text-muted-foreground">No further actions</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {workflowRecord && (
        <section id="offboarding-workflow-panel" className={`${panelClass} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Case workflow</p>
              <h2 className="mt-1 text-lg font-semibold">{employeeName(workflowRecord.staffProfile)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {workflowRecord.staffProfile.employeeNumber} · {label(workflowRecord.status)}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className={secondaryButtonClass} disabled={workflowLoading} onClick={() => void loadWorkflow(workflowRecord)}>
                <RefreshCw className={`size-4 ${workflowLoading ? "animate-spin" : ""}`} />Refresh workflow
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => { setWorkflowRecord(null); setWorkflowData(null); setWorkflowError(""); }}>Close</button>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            {workflowError && (
              <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
                {workflowError}
              </div>
            )}
            {workflowLoading && (
              <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />Loading tasks, access revocations, and settlement…
              </div>
            )}
            {workflowData && !workflowLoading && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">Required tasks</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {workflowData.tasks.filter((task) => task.required && (task.status === "COMPLETED" || (task.status === "WAIVED" && Boolean(task.exceptionReason?.trim())))).length}
                      <span className="text-sm font-normal text-muted-foreground"> / {workflowData.tasks.filter((task) => task.required).length}</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">Required access outcomes</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {workflowData.revocations.filter((item) => item.required && (item.status === "REVOKED" || item.status === "NOT_APPLICABLE") && Boolean(item.verifiedAt) && Boolean(item.outcomeNotes?.trim())).length}
                      <span className="text-sm font-normal text-muted-foreground"> / {workflowData.revocations.filter((item) => item.required).length}</span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">Final settlement</p>
                    <p className="mt-1 text-lg font-semibold">{workflowData.settlement ? label(workflowData.settlement.status) : "Not created"}</p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Clearance and handover tasks</h3>
                    <span className="text-xs text-muted-foreground">{workflowData.tasks.length} tasks</span>
                  </div>
                  {workflowData.tasks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No tasks were returned for this case. The case cannot be completed without required clearance tasks.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[620px] text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr><th className="px-3 py-2">Task</th><th className="px-3 py-2">Required</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Due</th><th className="px-3 py-2">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {workflowData.tasks.map((task) => (
                            <tr key={task.id}>
                              <td className="px-3 py-3">
                                <p className="font-medium">{task.title}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{label(task.category)}</p>
                                {task.evidenceRef && <p className="mt-1 break-all text-xs text-muted-foreground">Evidence: {task.evidenceRef}</p>}
                                {task.documents.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {task.documents.map((document) => (
                                      <div key={document.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                        <span className="max-w-48 break-all">{document.originalFileName}</span>
                                        <span className="text-muted-foreground">
                                          {(document.sizeBytes / 1024).toFixed(0)} KB
                                        </span>
                                        {document.contentType === "application/pdf" && (
                                          <button
                                            type="button"
                                            className="underline underline-offset-2"
                                            onClick={() => setPreviewTaskDocument({
                                              id: document.id,
                                              taskId: task.id,
                                              originalFileName: document.originalFileName,
                                            })}
                                          >
                                            Preview
                                          </button>
                                        )}
                                        <a
                                          className="inline-flex items-center gap-1 underline underline-offset-2"
                                          href={taskDocumentUrl(task.id, document.id)}
                                        >
                                          <Download className="size-3" /> Download
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {task.status === "WAIVED" && task.exceptionReason && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Exception: {task.exceptionReason}</p>}
                              </td>
                              <td className="px-3 py-3">{task.required ? "Yes" : "No"}</td>
                              <td className="px-3 py-3">{label(task.status)}</td>
                              <td className="px-3 py-3">{formatDate(task.dueDate)}</td>
                              <td className="px-3 py-3">
                                <button type="button" className={secondaryButtonClass} onClick={() => { setEditingTask(task); setTaskStatus(task.status); setTaskEvidenceRef(task.evidenceRef ?? ""); setTaskReviewNotes(""); setTaskExceptionReason(task.exceptionReason ?? ""); setWorkflowError(""); }}>Edit</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {editingTask && (
                    <form onSubmit={saveTaskEdit} className="mt-4 space-y-4 rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold">Edit clearance task</h4>
                        <button type="button" className={secondaryButtonClass} onClick={() => setEditingTask(null)}>Cancel</button>
                      </div>
                      <p className="text-sm text-muted-foreground">{editingTask.title}</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-1 text-sm">
                          <span className="font-medium">Status</span>
                          <select className={inputClass} value={taskStatus} onChange={(event) => setTaskStatus(event.target.value)}>
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="BLOCKED">Blocked</option>
                            <option value="WAIVED">Waived</option>
                          </select>
                        </label>
                        <label className="space-y-1 text-sm">
                          <span className="font-medium">Evidence reference</span>
                          <input className={inputClass} value={taskEvidenceRef} onChange={(event) => setTaskEvidenceRef(event.target.value)} placeholder="Document or evidence reference" />
                        </label>
                      </div>
                      {canReviewTasks && (
                        <label className="block space-y-1 text-sm">
                          <span className="font-medium">Review notes</span>
                          <textarea className={inputClass} value={taskReviewNotes} onChange={(event) => setTaskReviewNotes(event.target.value)} rows={2} placeholder="Optional review notes" />
                        </label>
                      )}
                      {taskStatus === "WAIVED" && (
                        <label className="block space-y-1 text-sm">
                          <span className="font-medium">Exception reason (required)</span>
                          <textarea className={inputClass} value={taskExceptionReason} onChange={(event) => setTaskExceptionReason(event.target.value)} rows={2} required />
                        </label>
                      )}
                      {taskStatus === "BLOCKED" && (
                        <label className="block space-y-1 text-sm">
                          <span className="font-medium">Reason for blocking</span>
                          <textarea className={inputClass} value={taskExceptionReason} onChange={(event) => setTaskExceptionReason(event.target.value)} rows={2} required />
                        </label>
                      )}
                      <div className="space-y-3 rounded-lg border border-border p-3">
                        <div>
                          <h5 className="text-sm font-semibold">Supporting documents</h5>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Attach the actual document related to this clearance task. PDF, JPEG, or PNG; maximum 10 MiB per file.
                          </p>
                        </div>
                        {editingTask.documents.length > 0 && (
                          <ul className="space-y-2">
                            {editingTask.documents.map((document) => (
                              <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="flex min-w-0 items-center gap-2">
                                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                                  <span className="break-all">{document.originalFileName}</span>
                                </span>
                                <span className="flex shrink-0 items-center gap-3">
                                  {document.contentType === "application/pdf" && (
                                    <button
                                      type="button"
                                      className="text-xs underline underline-offset-2"
                                      onClick={() => setPreviewTaskDocument({
                                        id: document.id,
                                        taskId: editingTask.id,
                                        originalFileName: document.originalFileName,
                                      })}
                                    >
                                      Preview
                                    </button>
                                  )}
                                  <a className="text-xs underline underline-offset-2" href={taskDocumentUrl(editingTask.id, document.id)}>Download</a>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <label className="min-w-0 flex-1 space-y-1 text-sm">
                            <span className="font-medium">Choose document</span>
                            <input
                              id="offboarding-task-document-file"
                              className={inputClass}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                              onChange={(event) => setTaskDocumentFile(event.target.files?.[0] ?? null)}
                              disabled={taskDocumentUploading}
                            />
                          </label>
                          <button type="button" onClick={() => { void uploadTaskDocument(); }} className={secondaryButtonClass} disabled={!taskDocumentFile || taskDocumentUploading}>
                            {taskDocumentUploading ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                            {taskDocumentUploading ? "Uploading…" : "Upload document"}
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="submit" className={buttonClass} disabled={taskSaving}>
                          {taskSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                          {taskSaving ? "Saving…" : "Save task"}
                        </button>
                      </div>
                    </form>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">Task updates require evidence to complete a task and a documented reason to block or waive one. Use the existing task API for those changes; this panel displays the persisted status.</p>
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Access revocation and verification</h3>
                    <span className="text-xs text-muted-foreground">{workflowData.revocations.length} records</span>
                  </div>
                  {workflowData.revocations.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No access revocation requests exist. Record the applicable access types and verify their actual outcomes before completing the case.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[620px] text-left text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                          <tr><th className="px-3 py-2">Access type</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Required</th><th className="px-3 py-2">Outcome</th><th className="px-3 py-2">Verified</th><th className="px-3 py-2">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {workflowData.revocations.map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-3">{label(item.accessType)}</td>
                              <td className="max-w-56 break-all px-3 py-3">{item.target}</td>
                              <td className="px-3 py-3">{item.required ? "Yes" : "No"}</td>
                              <td className="px-3 py-3">
                                <p>{label(item.status)}</p>
                                {item.outcomeNotes && <p className="mt-1 max-w-64 text-xs text-muted-foreground">{item.outcomeNotes}</p>}
                              </td>
                              <td className="px-3 py-3">{formatDate(item.verifiedAt)}</td>
                              <td className="px-3 py-3">
                                <button type="button" className={secondaryButtonClass} onClick={() => { setEditingRevocation(item); setRevocationStatus(item.status); setRevocationNotes(item.outcomeNotes ?? ""); setRevocationReference(""); setWorkflowError(""); }}>Edit</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">A request is not proof of revocation. The status must reflect the verified outcome, with the server recording the verifier and timestamp.</p>
                  {editingRevocation && (
                    <form onSubmit={saveRevocationEdit} className="mt-4 space-y-4 rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold">Edit access outcome</h4>
                        <button type="button" className={secondaryButtonClass} onClick={() => setEditingRevocation(null)}>Cancel</button>
                      </div>
                      <p className="break-all text-sm text-muted-foreground">{label(editingRevocation.accessType)} · {editingRevocation.target}</p>
                      <label className="block space-y-1 text-sm">
                        <span className="font-medium">Outcome status</span>
                        <select className={inputClass} value={revocationStatus} onChange={(event) => setRevocationStatus(event.target.value)}>
                          <option value="PENDING">Pending</option>
                          <option value="IN_PROGRESS">In progress</option>
                          <option value="REVOKED">Revoked and verified</option>
                          <option value="NOT_APPLICABLE">Not applicable</option>
                          <option value="FAILED">Failed</option>
                        </select>
                      </label>
                      <label className="block space-y-1 text-sm">
                        <span className="font-medium">Outcome notes {["REVOKED", "NOT_APPLICABLE", "FAILED"].includes(revocationStatus) ? "(required)" : "(optional)"}</span>
                        <textarea className={inputClass} value={revocationNotes} onChange={(event) => setRevocationNotes(event.target.value)} rows={3} maxLength={3000} required={["REVOKED", "NOT_APPLICABLE", "FAILED"].includes(revocationStatus)} placeholder="Record what was checked and the actual result." />
                      </label>
                      <label className="block space-y-1 text-sm">
                        <span className="font-medium">External reference (optional)</span>
                        <input className={inputClass} value={revocationReference} onChange={(event) => setRevocationReference(event.target.value)} maxLength={500} placeholder="Ticket, system reference, or evidence ID" />
                      </label>
                      <p className="text-xs text-muted-foreground">The server records the verifier, verification time, and audit event. A verified outcome cannot be downgraded through this form.</p>
                      <div className="flex justify-end">
                        <button type="submit" className={buttonClass} disabled={revocationSaving}>
                          {revocationSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                          {revocationSaving ? "Saving…" : "Save access outcome"}
                        </button>
                      </div>
                    </form>
                  )}

                </div>

                <div>
                  <h3 className="mb-2 font-semibold">Final settlement</h3>
                  {!workflowData.settlement ? (
                    <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No settlement exists yet. Create a draft settlement through the settlement endpoint, then add itemized amounts and follow the review and payment workflow.</p>
                  ) : (
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{label(workflowData.settlement.status)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Currency: {workflowData.settlement.currency} · {workflowData.settlement.items.length} line items</p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums">
                          {workflowData.settlement.items.reduce((sum, item) => sum + Number(item.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {workflowData.settlement.currency}
                        </p>
                      </div>
                      {workflowData.settlement.items.length > 0 && (
                        <div className="mt-3 divide-y divide-border border-t border-border">
                          {workflowData.settlement.items.map((item) => (
                            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                              <div><p className="font-medium">{item.description}</p><p className="text-xs text-muted-foreground">{label(item.itemType)}</p></div>
                              <div className="flex items-center gap-3">
                                <p className="tabular-nums">{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.currency}</p>
                                {workflowData.settlement?.status === "DRAFT" && (
                                  <button
                                    type="button"
                                    className={secondaryButtonClass}
                                    onClick={() => {
                                      setEditingSettlementItem(item);
                                      setSettlementItemType(item.itemType);
                                      setSettlementItemDescription(item.description);
                                      setSettlementItemAmount(String(item.amount));
                                      setSettlementItemNotes("");
                                      setSettlementItemReference("");
                                      setWorkflowError("");
                                    }}
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {editingSettlementItem && workflowData.settlement.status === "DRAFT" && (
                        <form onSubmit={saveSettlementItemEdit} className="mt-4 space-y-4 rounded-xl border border-border bg-muted/30 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="font-semibold">Edit settlement item</h4>
                            <button type="button" className={secondaryButtonClass} onClick={() => setEditingSettlementItem(null)} disabled={settlementItemSaving}>Cancel</button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-1.5 text-sm font-medium">Item type
                              <select className={inputClass} value={settlementItemType} onChange={(event) => setSettlementItemType(event.target.value)}>
                                <option value="FINAL_SALARY">Final salary</option>
                                <option value="UNUSED_LEAVE_PAYOUT">Unused leave payout</option>
                                <option value="APPROVED_EXPENSE">Approved expense</option>
                                <option value="OUTSTANDING_ADVANCE">Outstanding advance</option>
                                <option value="OTHER_ADJUSTMENT">Other adjustment</option>
                                <option value="CONTRACTUAL_BENEFIT">Contractual benefit</option>
                                <option value="SEVERANCE">Severance</option>
                                <option value="DEDUCTION">Deduction</option>
                              </select>
                            </label>
                            <label className="space-y-1.5 text-sm font-medium">Amount ({workflowData.settlement.currency})
                              <input required className={inputClass} inputMode="decimal" value={settlementItemAmount} onChange={(event) => setSettlementItemAmount(event.target.value)} pattern="\\d{1,12}(\\.\\d{1,2})?" />
                            </label>
                            <label className="space-y-1.5 text-sm font-medium md:col-span-2">Description
                              <input required maxLength={500} className={inputClass} value={settlementItemDescription} onChange={(event) => setSettlementItemDescription(event.target.value)} />
                            </label>
                            <label className="space-y-1.5 text-sm font-medium md:col-span-2">Calculation notes (optional)
                              <textarea maxLength={3000} rows={2} className={inputClass} value={settlementItemNotes} onChange={(event) => setSettlementItemNotes(event.target.value)} />
                            </label>
                            <label className="space-y-1.5 text-sm font-medium md:col-span-2">Reference (optional)
                              <input maxLength={500} className={inputClass} value={settlementItemReference} onChange={(event) => setSettlementItemReference(event.target.value)} />
                            </label>
                          </div>
                          <p className="text-xs text-muted-foreground">Only draft settlements can be edited. Changes are validated and audited by the server.</p>
                          <div className="flex justify-end">
                            <button type="submit" className={buttonClass} disabled={settlementItemSaving}>
                              {settlementItemSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                              {settlementItemSaving ? "Saving…" : "Save settlement item"}
                            </button>
                          </div>
                        </form>
                      )}
                      <div className="mt-4 border-t border-border pt-4">
                        <h4 className="font-semibold">Settlement actions</h4>
                        {workflowData.settlement.status === "PAID" && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Employee acknowledgment: {workflowData.settlement.employeeAcknowledged ? "Recorded" : "Not recorded"}
                          </p>
                        )}
                        {(() => {
                          const status = workflowData.settlement.status;
                          const actions = [
                            ...(status === "DRAFT" ? [{ value: "submit_for_review", label: "Submit for review" }] : []),
                            ...(status === "IN_REVIEW" ? [{ value: "approve", label: "Approve settlement" }] : []),
                            ...(status === "APPROVED" ? [{ value: "request_payment", label: "Request payment" }] : []),
                            ...(status === "PAYMENT_PENDING" ? [{ value: "mark_paid", label: "Record payment" }] : []),
                            ...(status === "PAID" && !workflowData.settlement.employeeAcknowledged ? [{ value: "acknowledge", label: "Record employee acknowledgment" }] : []),
                            ...(!["PAID", "CANCELLED", "DISPUTED"].includes(status) ? [{ value: "mark_disputed", label: "Mark disputed" }] : []),
                            ...(!["PAID", "CANCELLED"].includes(status) ? [{ value: "cancel", label: "Cancel settlement" }] : []),
                          ];
                          if (actions.length === 0) {
                            return <p className="mt-2 text-sm text-muted-foreground">No workflow actions are available for this settlement state.</p>;
                          }
                          const selected = actions.some((item) => item.value === settlementAction)
                            ? settlementAction : actions[0].value;
                          return (
                            <form
                              key={selected}
                              onSubmit={(event) => {
                                if (selected !== settlementAction) {
                                  event.preventDefault();
                                  setSettlementAction(selected);
                                  return;
                                }
                                void runSettlementAction(event);
                              }}
                              className="mt-3 space-y-3"
                            >
                              <label className="block space-y-1.5 text-sm font-medium">Action
                                <select className={inputClass} value={selected} onChange={(event) => setSettlementAction(event.target.value)}>
                                  {actions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                                </select>
                              </label>
                              {selected === "mark_paid" && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <label className="space-y-1.5 text-sm font-medium">Payment date
                                    <input required type="date" className={inputClass} value={settlementPaymentDate} onChange={(event) => setSettlementPaymentDate(event.target.value)} />
                                  </label>
                                  <label className="space-y-1.5 text-sm font-medium">Payment reference
                                    <input required maxLength={500} className={inputClass} value={settlementPaymentReference} onChange={(event) => setSettlementPaymentReference(event.target.value)} />
                                  </label>
                                  <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Payment evidence reference
                                    <input required maxLength={1000} className={inputClass} value={settlementPaymentEvidence} onChange={(event) => setSettlementPaymentEvidence(event.target.value)} />
                                  </label>
                                </div>
                              )}
                              {selected === "acknowledge" && (
                                <label className="block space-y-1.5 text-sm font-medium">Employee acknowledgment reference
                                  <input required maxLength={1000} className={inputClass} value={settlementAcknowledgmentRef} onChange={(event) => setSettlementAcknowledgmentRef(event.target.value)} />
                                </label>
                              )}
                              {(selected === "mark_disputed" || selected === "cancel") && (
                                <label className="block space-y-1.5 text-sm font-medium">Reason
                                  <textarea required maxLength={5000} rows={3} className={inputClass} value={settlementActionNotes} onChange={(event) => setSettlementActionNotes(event.target.value)} />
                                </label>
                              )}
                              {selected === "approve" && (
                                <p className="text-xs text-muted-foreground">The server prevents the settlement preparer from approving their own settlement.</p>
                              )}
                              <div className="flex justify-end">
                                <button type="submit" className={buttonClass} disabled={settlementActionSaving || workflowLoading}>
                                  {settlementActionSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
                                  {settlementActionSaving ? "Processing…" : actions.find((item) => item.value === selected)?.label}
                                </button>
                              </div>
                            </form>
                          );
                        })()}
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Payment date: {formatDate(workflowData.settlement.paymentDate)} · Reference: {workflowData.settlement.paymentReference || "Not recorded"} · Payment evidence: {workflowData.settlement.paymentEvidenceRef || "Not recorded"}
                      </p>
                    </div>
                  )}
                </div>

                {workflowRecord.status === "APPROVED" && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                    <p className="font-semibold">Completion requirements</p>
                    <p className="mt-1 text-muted-foreground">The server also checks the confirmed last day, pending disputes or investigations, all required tasks, verified access outcomes, school membership state, and a paid settlement with payment evidence. If completion is blocked, the server response identifies the next requirement.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 p-4 py-8" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowCreate(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="offboarding-create-title" className="w-full max-w-3xl rounded-2xl border border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Employment &amp; Insights</p><h2 id="offboarding-create-title" className="mt-1 text-xl font-semibold">Create offboarding case</h2><p className="mt-1 text-sm text-muted-foreground">The case starts as a draft. Employee status is not changed until final completion.</p></div>
              <button type="button" className={secondaryButtonClass} aria-label="Close form" onClick={() => setShowCreate(false)} disabled={saving}><X className="size-4" /></button>
            </div>
            <form onSubmit={createCase} className="space-y-5 p-5">
              {error && (
                <div role="alert" aria-live="assertive" className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="mt-0.5 size-5 shrink-0" />
                  <p className="min-w-0 flex-1">{error}</p>
                  <button type="button" className="shrink-0" aria-label="Dismiss error" onClick={() => setError("")}><X className="size-4" /></button>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium md:col-span-2">Employee
                  <select required className={inputClass} value={selectedStaffId} onChange={(event) => setSelectedStaffId(event.target.value)}>
                    <option value="">Select an employee…</option>
                    {eligibleStaff.map((member) => <option key={member.id} value={member.id}>{employeeName(member)} · {member.employeeNumber}{member.jobTitle ? ` · ${member.jobTitle}` : ""}</option>)}
                  </select>
                  {eligibleStaff.length === 0 && <span className="block text-xs font-normal text-muted-foreground">No eligible employees found. Existing active cases and terminated employees are excluded.</span>}
                </label>
                <label className="space-y-1.5 text-sm font-medium">Exit type
                  <select className={inputClass} value={exitType} onChange={(event) => setExitType(event.target.value)}>{exitTypes.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
                </label>
                <label className="space-y-1.5 text-sm font-medium">Initiated by
                  <select className={inputClass} value={initiator} onChange={(event) => setInitiator(event.target.value)}><option value="EMPLOYEE">Employee</option><option value="SCHOOL">School</option><option value="MUTUAL">Mutual agreement</option></select>
                </label>
                <label className="space-y-1.5 text-sm font-medium">Reason category
                  <input className={inputClass} maxLength={120} value={reasonCategory} onChange={(event) => setReasonCategory(event.target.value)} placeholder="e.g. Career change" />
                </label>
                <label className="space-y-1.5 text-sm font-medium">Proposed last working day
                  <input type="date" className={inputClass} value={proposedLastDay} onChange={(event) => setProposedLastDay(event.target.value)} />
                </label>
                <label className="space-y-1.5 text-sm font-medium">Notice date
                  <input type="date" className={inputClass} value={noticeDate} onChange={(event) => setNoticeDate(event.target.value)} />
                </label>
                <div className="flex flex-col justify-center gap-3 rounded-xl border border-border p-3">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={noticeRequired} onChange={(event) => setNoticeRequired(event.target.checked)} /> Notice period required</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={noticeGiven} onChange={(event) => setNoticeGiven(event.target.checked)} /> Notice has been given</label>
                </div>
                <div className="flex flex-col justify-center gap-3 rounded-xl border border-border p-3">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={disputePending} onChange={(event) => setDisputePending(event.target.checked)} /> Dispute pending</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={investigationPending} onChange={(event) => setInvestigationPending(event.target.checked)} /> Investigation pending</label>
                </div>
                <label className="space-y-1.5 text-sm font-medium md:col-span-2">Reason and handover context
                  <textarea className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" maxLength={2000} value={reasonNotes} onChange={(event) => setReasonNotes(event.target.value)} placeholder="Document the relevant reason and operational context." />
                  <span className="block text-xs font-normal text-muted-foreground">Avoid unnecessary sensitive personal details.</span>
                </label>
                <label className="space-y-1.5 text-sm font-medium md:col-span-2">Confidential case notes (optional)
                  <textarea className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" maxLength={4000} value={confidentialNotes} onChange={(event) => setConfidentialNotes(event.target.value)} placeholder="Restricted case context for authorized HR personnel only." />
                  <span className="block text-xs font-normal text-muted-foreground">Maximum 4,000 characters. Record only information necessary for the case.</span>
                </label>
              </div>
              <div className="flex flex-col-reverse justify-end gap-2 border-t border-border pt-4 sm:flex-row">
                <button type="button" className={secondaryButtonClass} onClick={() => setShowCreate(false)} disabled={saving}>Cancel</button>
                <button type="submit" className={buttonClass} disabled={saving || !selectedStaffId}>{saving && <LoaderCircle className="size-4 animate-spin" />}Create draft</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {previewTaskDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-2 sm:p-5 lg:p-8"
          onClick={() => setPreviewTaskDocument(null)}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="offboarding-pdf-preview-title"
            className="flex h-[96dvh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:h-[92dvh]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="offboarding-pdf-preview-title" className="truncate text-sm font-semibold">
                    {previewTaskDocument.originalFileName}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Offboarding clearance · PDF preview
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={taskDocumentUrl(previewTaskDocument.taskId, previewTaskDocument.id)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Download className="size-4" />
                  Download
                </a>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setPreviewTaskDocument(null)}
                  aria-label="Close PDF preview"
                  className="flex size-9 items-center justify-center rounded-lg border border-border transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>
            <div className="relative flex min-h-0 flex-1 flex-col bg-muted/30">
              {previewTaskDocumentLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 text-sm text-muted-foreground">
                  <RefreshCw className="size-5 animate-spin text-primary" />
                  <span>Opening PDF preview…</span>
                </div>
              )}
              <iframe
                key={previewTaskDocument.id}
                title={`PDF preview: ${previewTaskDocument.originalFileName}`}
                onLoad={() => setPreviewTaskDocumentLoading(false)}
                src={taskDocumentUrl(previewTaskDocument.taskId, previewTaskDocument.id, true)}
                className="h-full min-h-0 w-full flex-1 border-0 bg-background"
              />
            </div>
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
              <span className="truncate">{previewTaskDocument.originalFileName}</span>
              <button
                type="button"
                onClick={() => setPreviewTaskDocument(null)}
                className="shrink-0 rounded-lg px-3 py-2 font-medium text-foreground hover:bg-muted"
              >
                Close preview
              </button>
            </footer>
          </section>
        </div>
      )}

      {actionRecord && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 p-4 py-8" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setActionRecord(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="offboarding-action-title" className="w-full max-w-xl rounded-2xl border border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Workflow transition</p><h2 id="offboarding-action-title" className="mt-1 text-xl font-semibold">{label(actionType)} case</h2><p className="mt-1 text-sm text-muted-foreground">{employeeName(actionRecord.staffProfile)} · {actionRecord.staffProfile.employeeNumber}</p></div>
              <button type="button" className={secondaryButtonClass} aria-label="Close action" onClick={() => setActionRecord(null)} disabled={saving}><X className="size-4" /></button>
            </div>
            <form onSubmit={runAction} className="space-y-4 p-5">
              {actionType === "approve" && <>
                <label className="block space-y-1.5 text-sm font-medium">Confirmed last working day
                  <input type="date" required className={inputClass} value={actionDate} onChange={(event) => setActionDate(event.target.value)} />
                </label>
                <label className="block space-y-1.5 text-sm font-medium">Rehire eligibility
                  <select className={inputClass} value={rehireEligible} onChange={(event) => setRehireEligible(event.target.value)}><option value="unset">Leave undecided</option><option value="yes">Eligible for rehire</option><option value="no">Not eligible for rehire</option></select>
                </label>
              </>}
              {actionType === "reject" && <label className="block space-y-1.5 text-sm font-medium">Rejection reason
                <textarea required minLength={3} maxLength={1000} className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder="Explain why the case is being rejected." />
              </label>}
              {actionType === "complete" && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><p className="font-semibold">Final completion</p><p className="mt-1 text-muted-foreground">This action will terminate the employee record only after the server verifies required clearance tasks, access revocation outcomes, school membership state, and a paid final settlement. Access must be revoked and verified through the dedicated access workflow first.</p><p className="mt-2 font-medium">Confirmed last day: {formatDate(actionRecord.confirmedLastDay)}</p></div>}
              {actionType === "withdraw" && <p className="text-sm text-muted-foreground">Withdraw this case from the active workflow? The employee status will not be changed.</p>}
              {actionType === "submit" && <p className="text-sm text-muted-foreground">Submit this draft for review.</p>}
              {actionType === "review" && <p className="text-sm text-muted-foreground">Move this submitted case into review so it can be approved or rejected.</p>}
              <div className="flex flex-col-reverse justify-end gap-2 border-t border-border pt-4 sm:flex-row">
                <button type="button" className={secondaryButtonClass} onClick={() => setActionRecord(null)} disabled={saving}>Cancel</button>
                <button type="submit" className={buttonClass} disabled={saving}>{saving && <LoaderCircle className="size-4 animate-spin" />}{label(actionType)} case <ArrowUpRight className="size-4" /></button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
