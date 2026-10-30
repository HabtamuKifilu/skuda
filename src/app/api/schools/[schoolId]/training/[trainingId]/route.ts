import { NextRequest } from "next/server";
import {
  SchoolMembershipRole,
  StaffTrainingStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ schoolId: string; trainingId: string }>;
};

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
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

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, trainingId } = await context.params;
    const authorization = await requireSchoolRole(request.headers, schoolId, [...roles]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }
    if (!isObject(body)) {
      return Response.json({ error: "A valid update is required." }, { status: 400 });
    }

    const allowed = [
      "staffProfileId", "title", "provider", "trainingType", "description",
      "startDate", "endDate", "completionDate", "status", "outcome", "notes",
    ];
    if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) {
      return Response.json({ error: "The update is empty or contains unsupported fields." }, { status: 400 });
    }

    const current = await prisma.staffTrainingRecord.findFirst({
      where: { id: trainingId, schoolId },
    });
    if (!current) {
      return Response.json({ error: "Training record not found in this school." }, { status: 404 });
    }

    const staffProfileId = body.staffProfileId === undefined
      ? current.staffProfileId
      : body.staffProfileId;
    if (typeof staffProfileId !== "string" || !staffProfileId.trim()) {
      return Response.json({ error: "Select a valid employee." }, { status: 400 });
    }

    const title = body.title === undefined ? current.title : body.title;
    if (typeof title !== "string" || !title.trim() || title.trim().length > 160) {
      return Response.json({ error: "Enter a title up to 160 characters." }, { status: 400 });
    }

    const startDate = body.startDate === undefined
      ? current.startDate
      : validDate(body.startDate);
    const endDate = body.endDate === undefined
      ? current.endDate
      : body.endDate === null || body.endDate === ""
        ? null
        : validDate(body.endDate);
    const completionDate = body.completionDate === undefined
      ? current.completionDate
      : body.completionDate === null || body.completionDate === ""
        ? null
        : validDate(body.completionDate);
    const status = body.status === undefined ? current.status : body.status;

    if (!startDate || (body.startDate !== undefined && !validDate(body.startDate))) {
      return Response.json({ error: "Enter a valid start date." }, { status: 400 });
    }
    if (body.endDate !== undefined && body.endDate !== null && body.endDate !== "" && !endDate) {
      return Response.json({ error: "Enter a valid end date." }, { status: 400 });
    }
    if (body.completionDate !== undefined && body.completionDate !== null && body.completionDate !== "" && !completionDate) {
      return Response.json({ error: "Enter a valid completion date." }, { status: 400 });
    }
    if (endDate && endDate < startDate) {
      return Response.json({ error: "End date cannot precede start date." }, { status: 400 });
    }
    if (completionDate && completionDate < startDate) {
      return Response.json({ error: "Completion date cannot precede start date." }, { status: 400 });
    }
    if (!Object.values(StaffTrainingStatus).includes(status as StaffTrainingStatus)) {
      return Response.json({ error: "Choose a valid training status." }, { status: 400 });
    }
    if (status === StaffTrainingStatus.COMPLETED && !completionDate) {
      return Response.json({ error: "A completion date is required for completed training." }, { status: 400 });
    }

    const textFields = [
      ["provider", 160],
      ["trainingType", 120],
      ["description", 2000],
      ["outcome", 1000],
      ["notes", 2000],
    ] as const;
    const textValues: Record<string, string | null> = {};
    for (const [key, max] of textFields) {
      const value = body[key];
      if (value === undefined) continue;
      if (value !== null && value !== "" && typeof value !== "string") {
        return Response.json({ error: `${key} must be text.` }, { status: 400 });
      }
      if (typeof value === "string" && value.trim().length > max) {
        return Response.json({ error: `${key} cannot exceed ${max} characters.` }, { status: 400 });
      }
      textValues[key] = typeof value === "string" ? value.trim() || null : null;
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingRecord = await tx.staffTrainingRecord.findFirst({
        where: { id: trainingId, schoolId },
        select: { id: true },
      });
      if (!existingRecord) {
        return { error: "Training record not found in this school.", status: 404 as const };
      }

      const employee = await tx.staffProfile.findFirst({
        where: { id: staffProfileId, schoolId },
        select: { id: true, employeeNumber: true },
      });
      if (!employee) return { error: "Employee not found in this school.", status: 404 as const };

      const record = await tx.staffTrainingRecord.update({
        where: { id: existingRecord.id },
        data: {
          staffProfileId: employee.id,
          title: title.trim(),
          ...(body.startDate !== undefined ? { startDate } : {}),
          ...(body.endDate !== undefined ? { endDate } : {}),
          ...(body.completionDate !== undefined ? { completionDate } : {}),
          ...(body.status !== undefined ? { status: status as StaffTrainingStatus } : {}),
          ...textValues,
        },
        include: { staffProfile: { select: employeeSelect } },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_TRAINING_UPDATED",
        resourceType: "StaffTrainingRecord",
        resourceId: record.id,
        metadata: { staffProfileId: employee.id, title: record.title },
      }, request);

      return { record };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({ record: result.record });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to update training record:", error);
    return Response.json({ error: "Unable to update training record." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { schoolId, trainingId } = await context.params;
    const authorization = await requireSchoolRole(request.headers, schoolId, [...roles]);

    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.staffTrainingRecord.findFirst({
        where: { id: trainingId, schoolId },
        select: { id: true, title: true, staffProfileId: true },
      });
      if (!record) return { missing: true as const };

      await tx.staffTrainingRecord.delete({ where: { id: record.id } });
      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_TRAINING_DELETED",
        resourceType: "StaffTrainingRecord",
        resourceId: record.id,
        metadata: { title: record.title, staffProfileId: record.staffProfileId },
      }, request);
      return { missing: false as const };
    });

    if (result.missing) {
      return Response.json({ error: "Training record not found in this school." }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to delete training record:", error);
    return Response.json({ error: "Unable to delete training record." }, { status: 500 });
  }
}
