import { NextRequest } from "next/server";
import {
  SchoolMembershipRole,
  StaffDocumentType,
  StaffTrainingStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = { params: Promise<{ schoolId: string }> };

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const trainingStatuses = Object.values(StaffTrainingStatus);
const qualificationTypes = [
  StaffDocumentType.EDUCATIONAL_CERTIFICATE,
  StaffDocumentType.EXPERIENCE_LETTER,
  StaffDocumentType.PROFESSIONAL_CERTIFICATE,
];

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function optionalText(value: unknown, max: number, field: string) {
  if (value === undefined || value === null || value === "") {
    return { value: null as string | null };
  }
  if (typeof value !== "string" || value.trim().length > max) {
    return { error: `${field} must be text of at most ${max} characters.` };
  }
  return { value: value.trim() || null };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const employeeSelect = {
  id: true,
  employeeNumber: true,
  firstName: true,
  middleName: true,
  lastName: true,
  jobTitle: true,
  department: true,
  status: true,
} as const;

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...roles]);

    const [records, employees, documents] = await Promise.all([
      prisma.staffTrainingRecord.findMany({
        where: { schoolId },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        include: { staffProfile: { select: employeeSelect } },
      }),
      prisma.staffProfile.findMany({
        where: { schoolId },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: employeeSelect,
      }),
      prisma.staffDocument.findMany({
        where: { schoolId, documentType: { in: qualificationTypes } },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          staffProfileId: true,
          documentType: true,
          title: true,
          originalFileName: true,
          issueDate: true,
          expiryDate: true,
          reviewStatus: true,
          reviewedAt: true,
          reviewNotes: true,
          createdAt: true,
          staffProfile: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
              jobTitle: true,
              department: true,
            },
          },
        },
      }),
    ]);

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const expiryCutoff = new Date(today);
    expiryCutoff.setUTCDate(expiryCutoff.getUTCDate() + 60);

    const qualificationStats = {
      total: documents.length,
      pendingReview: documents.filter((d) => d.reviewStatus === "PENDING").length,
      rejected: documents.filter((d) => d.reviewStatus === "REJECTED").length,
      expired: documents.filter((d) => d.expiryDate && d.expiryDate < today).length,
      expiringSoon: documents.filter(
        (d) => d.expiryDate && d.expiryDate >= today && d.expiryDate <= expiryCutoff,
      ).length,
    };

    return Response.json({
      records,
      employees,
      qualifications: documents,
      qualificationStats,
      trainingStats: {
        total: records.length,
        planned: records.filter((r) => r.status === StaffTrainingStatus.PLANNED).length,
        inProgress: records.filter((r) => r.status === StaffTrainingStatus.IN_PROGRESS).length,
        completed: records.filter((r) => r.status === StaffTrainingStatus.COMPLETED).length,
        cancelled: records.filter((r) => r.status === StaffTrainingStatus.CANCELLED).length,
      },
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to load qualifications and training:", error);
    return Response.json({ error: "Unable to load qualifications and training." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(request.headers, schoolId, [...roles]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!isObject(body)) {
      return Response.json({ error: "A training record is required." }, { status: 400 });
    }

    const allowed = [
      "staffProfileId", "title", "provider", "trainingType", "description",
      "startDate", "endDate", "completionDate", "status", "outcome", "notes",
    ];
    if (Object.keys(body).some((key) => !allowed.includes(key))) {
      return Response.json({ error: "The request contains unsupported fields." }, { status: 400 });
    }

    if (
      typeof body.staffProfileId !== "string" ||
      !body.staffProfileId.trim() ||
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.trim().length > 160
    ) {
      return Response.json({ error: "Select an employee and enter a title up to 160 characters." }, { status: 400 });
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return Response.json({ error: "Training title is required." }, { status: 400 });
    }

    const startDate = validDate(body.startDate);
    const endDate = body.endDate ? validDate(body.endDate) : null;
    const completionDate = body.completionDate ? validDate(body.completionDate) : null;
    const status = body.status ?? StaffTrainingStatus.PLANNED;

    if (!startDate || (body.endDate && !endDate) || (body.completionDate && !completionDate)) {
      return Response.json({ error: "Enter valid training dates." }, { status: 400 });
    }
    if (endDate && endDate < startDate) {
      return Response.json({ error: "End date cannot precede start date." }, { status: 400 });
    }
    if (completionDate && completionDate < startDate) {
      return Response.json({ error: "Completion date cannot precede start date." }, { status: 400 });
    }
    if (!trainingStatuses.includes(status as StaffTrainingStatus)) {
      return Response.json({ error: "Choose a valid training status." }, { status: 400 });
    }
    if (status === StaffTrainingStatus.COMPLETED && !completionDate) {
      return Response.json({ error: "A completion date is required for completed training." }, { status: 400 });
    }

    const fields = [
      ["provider", 160, "Provider"],
      ["trainingType", 120, "Training type"],
      ["description", 2000, "Description"],
      ["outcome", 1000, "Outcome"],
      ["notes", 2000, "Notes"],
    ] as const;
    const textValues: Record<string, string | null> = {};
    for (const [key, max, label] of fields) {
      const parsed = optionalText(body[key], max, label);
      if ("error" in parsed) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }
      textValues[key] = parsed.value;
    }

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.staffProfile.findFirst({
        where: { id: body.staffProfileId as string, schoolId },
        select: { id: true, employeeNumber: true },
      });
      if (!employee) return { error: "Employee not found in this school.", status: 404 as const };

      const record = await tx.staffTrainingRecord.create({
        data: {
          schoolId,
          staffProfileId: employee.id,
          title,
          provider: textValues.provider,
          trainingType: textValues.trainingType,
          description: textValues.description,
          startDate,
          endDate,
          completionDate,
          status: status as StaffTrainingStatus,
          outcome: textValues.outcome,
          notes: textValues.notes,
          createdById: authorization.userId,
        },
        include: { staffProfile: { select: employeeSelect } },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_TRAINING_CREATED",
        resourceType: "StaffTrainingRecord",
        resourceId: record.id,
        metadata: { staffProfileId: employee.id, employeeNumber: employee.employeeNumber, title: record.title },
      }, request);

      return { record };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({ record: result.record }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to create training record:", error);
    return Response.json({ error: "Unable to create training record." }, { status: 500 });
  }
}
