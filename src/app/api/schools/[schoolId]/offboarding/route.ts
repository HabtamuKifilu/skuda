import { NextRequest, NextResponse } from "next/server";
import {
  StaffOffboardingInitiator,
  StaffOffboardingStatus,
  StaffOffboardingType,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = { params: Promise<{ schoolId: string }> };

const roles = ["OWNER", "ADMIN", "HR_MANAGER"] as const;

const exitTypes = Object.values(StaffOffboardingType);
const initiators = Object.values(StaffOffboardingInitiator);

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) return undefined;
  return value.trim();
}

function publicRecord<T extends object>(record: T) {
  const sensitive = new Set([
    "confidentialNotes", "rehireDecisionNotes", "rejectionReason", "feedbackNotes",
  ]);
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !sensitive.has(key)),
  );
}

function optionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId } = await params;
    await requireSchoolRole(request.headers, schoolId, [...roles]);

    const status = request.nextUrl.searchParams.get("status");
    const staffProfileId = request.nextUrl.searchParams.get("staffProfileId");

    if (
      status &&
      !Object.values(StaffOffboardingStatus).includes(
        status as StaffOffboardingStatus,
      )
    ) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const records = await prisma.staffOffboarding.findMany({
      where: {
        schoolId,
        ...(status ? { status: status as StaffOffboardingStatus } : {}),
        ...(staffProfileId ? { staffProfileId } : {}),
      },
      include: {
        staffProfile: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            jobTitle: true,
            department: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ records: records.map(publicRecord) });
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Request failed." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId } = await params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...roles],
    );

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const allowedFields = [
      "staffProfileId", "exitType", "initiator", "reasonCategory",
      "reasonNotes", "confidentialNotes", "noticeRequired", "noticeGiven",
      "disputePending", "investigationPending", "noticeDate", "proposedLastDay",
    ];
    if (Object.keys(data).some((key) => !allowedFields.includes(key))) {
      return NextResponse.json(
        { error: "Request contains unsupported fields." },
        { status: 400 },
      );
    }
    const { staffProfileId, exitType, initiator } = data;

    if (
      typeof staffProfileId !== "string" ||
      !staffProfileId.trim() ||
      typeof exitType !== "string" ||
      !exitTypes.includes(exitType as StaffOffboardingType) ||
      typeof initiator !== "string" ||
      !initiators.includes(initiator as StaffOffboardingInitiator)
    ) {
      return NextResponse.json(
        { error: "A valid employee, exit type, and initiator are required." },
        { status: 400 },
      );
    }

    const reasonCategory = optionalText(data.reasonCategory, 120);
    const reasonNotes = optionalText(data.reasonNotes, 2000);
    const confidentialNotes = optionalText(data.confidentialNotes, 4000);
    const noticeDate = optionalDate(data.noticeDate);
    const proposedLastDay = optionalDate(data.proposedLastDay);

    const fieldErrors: Record<string, string> = {};
    if (data.reasonCategory !== undefined && reasonCategory === undefined) fieldErrors.reasonCategory = "Must be text of at most 120 characters.";
    if (data.reasonNotes !== undefined && reasonNotes === undefined) fieldErrors.reasonNotes = "Must be text of at most 2000 characters.";
    if (data.confidentialNotes !== undefined && confidentialNotes === undefined) fieldErrors.confidentialNotes = "Must be text of at most 4000 characters.";
    if (data.noticeDate !== undefined && noticeDate === undefined) fieldErrors.noticeDate = "Must be a valid date.";
    if (data.proposedLastDay !== undefined && proposedLastDay === undefined) fieldErrors.proposedLastDay = "Must be a valid date.";

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        {
          error: "One or more offboarding fields are invalid.",
          issues: fieldErrors,
        },
        { status: 400 },
      );
    }

    const booleanFlag = (value: unknown): boolean | undefined =>
      value === undefined ? false : typeof value === "boolean" ? value : undefined;

    const noticeRequired = booleanFlag(data.noticeRequired);
    const noticeGiven = booleanFlag(data.noticeGiven);
    const disputePending = booleanFlag(data.disputePending);
    const investigationPending = booleanFlag(data.investigationPending);

    if (
      noticeRequired === undefined ||
      noticeGiven === undefined ||
      disputePending === undefined ||
      investigationPending === undefined
    ) {
      return NextResponse.json(
        { error: "Notice and case flags must be true or false." },
        { status: 400 },
      );
    }

    const staff = await prisma.staffProfile.findFirst({
      where: { id: staffProfileId.trim(), schoolId },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Employee not found in this school." },
        { status: 404 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffOffboarding.findFirst({
        where: {
          schoolId,
          staffProfileId: staff.id,
          status: {
            in: [
              StaffOffboardingStatus.DRAFT,
              StaffOffboardingStatus.SUBMITTED,
              StaffOffboardingStatus.UNDER_REVIEW,
              StaffOffboardingStatus.APPROVED,
            ],
          },
        },
        select: { id: true },
      });

      if (existing) {
        return {
          error: "An active offboarding record already exists for this employee.",
          status: 409 as const,
        };
      }

      const created = await tx.staffOffboarding.create({
        data: {
          schoolId,
          staffProfileId: staff.id,
          exitType: exitType as StaffOffboardingType,
          initiator: initiator as StaffOffboardingInitiator,
          status: StaffOffboardingStatus.DRAFT,
          reasonCategory,
          reasonNotes,
          confidentialNotes,
          noticeRequired,
          noticeGiven,
          noticeDate,
          proposedLastDay,
          disputePending,
          investigationPending,
          createdById: authorization.userId,
        },
        include: {
          staffProfile: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
              jobTitle: true,
              department: true,
              status: true,
            },
          },
        },
      });

      const defaultTasks = [
        {
          category: "HR_REVIEW",
          title: "HR offboarding review",
          description: "Verify the employee record, exit details, notice requirements, and required documentation.",
        },
        {
          category: "LEADERSHIP_APPROVAL",
          title: "Leadership approval",
          description: "Review and record the required leadership decision for this employee's departure.",
        },
        {
          category: "DEPARTMENT_CLEARANCE",
          title: "Department clearance",
          description: "Confirm departmental responsibilities, outstanding work, and clearance requirements.",
        },
        {
          category: "ACADEMIC_HANDOVER",
          title: "Academic handover",
          description: "Where applicable, hand over lesson plans, teaching materials, classes, and academic responsibilities.",
        },
        {
          category: "STUDENT_RECORDS_HANDOVER",
          title: "Student records handover",
          description: "Where applicable, securely transfer student records and document the authorized recipient.",
        },
        {
          category: "PROPERTY_RETURN",
          title: "Property and key return",
          description: "Record return or approved exception for keys, identification, and school property.",
        },
        {
          category: "ASSET_RETURN",
          title: "Equipment and asset return",
          description: "Record assigned equipment, condition, return, or documented exception.",
        },
        {
          category: "EMPLOYEE_DOCUMENTS",
          title: "Employee documents",
          description: "Collect and review applicable departure documents and required acknowledgements.",
        },
        {
          category: "EXIT_INTERVIEW",
          title: "Exit interview and feedback",
          description: "Offer and document the exit interview or record why it was not completed.",
        },
        {
          category: "FINANCE_CLEARANCE",
          title: "Finance clearance",
          description: "Reconcile outstanding advances, expenses, deductions, and other authorized financial obligations.",
        },
        {
          category: "FINAL_SETTLEMENT",
          title: "Prepare and pay final settlement",
          description: "Prepare, review, approve, and document the final settlement and payment evidence.",
        },
      ] as const;

      await tx.staffOffboardingTask.createMany({
        data: defaultTasks.map((task) => ({
          schoolId,
          staffProfileId: staff.id,
          offboardingId: created.id,
          category: task.category,
          title: task.title,
          description: task.description,
          required: true,
          status: "PENDING",
          createdById: authorization.userId,
        })),
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "SCHOOL_STAFF_OFFBOARDING_CREATED",
        resourceType: "StaffOffboarding",
        resourceId: created.id,
        metadata: {
          staffProfileId: staff.id,
          employeeNumber: staff.employeeNumber,
          exitType,
          initiator,
          status: created.status,
        },
      });

      return { record: created };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(
      { record: publicRecord(result.record) },
      { status: 201 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "A concurrent offboarding request conflicted with this submission. Refresh and try again." },
        { status: 409 },
      );
    }

    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to create staff offboarding record:", error);
    return NextResponse.json(
      { error: "Unable to create the offboarding record." },
      { status: 500 },
    );
  }
}
