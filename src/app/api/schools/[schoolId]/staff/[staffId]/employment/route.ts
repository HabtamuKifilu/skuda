import { NextRequest } from "next/server";
import {
  EmploymentChangeType,
  EmploymentType,
  Prisma,
  SchoolMembershipRole,
} from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string; staffId: string }>;
};

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const employmentSelect = {
  id: true,
  schoolId: true,
  staffProfileId: true,
  employmentType: true,
  startDate: true,
  contractStartDate: true,
  contractEndDate: true,
  contractReference: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaffEmploymentSelect;

function parseDate(
  value: unknown,
  label: string,
): { value: Date | null } | { error: string } {
  if (value === null || value === "") return { value: null };

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: `${label} must use YYYY-MM-DD format or be empty.` };
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return { error: `${label} must be a valid calendar date.` };
  }

  return { value: date };
}

function parseOptionalText(
  value: unknown,
  label: string,
  maxLength: number,
): { value: string | null } | { error: string } {
  if (value !== null && typeof value !== "string") {
    return { error: `${label} must be text or null.` };
  }

  const normalized = typeof value === "string" ? value.trim() : "";

  if (normalized.length > maxLength) {
    return { error: `${label} must not exceed ${maxLength} characters.` };
  }

  return { value: normalized || null };
}

function dateValue(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, staffId } = await context.params;

    await requireSchoolRole(request.headers, schoolId, [...managementRoles]);

    const staff = await prisma.staffProfile.findFirst({
      where: { id: staffId, schoolId },
      select: { id: true },
    });

    if (!staff) {
      return Response.json(
        { error: "Employee not found in this school." },
        { status: 404 },
      );
    }

    const employment = await prisma.staffEmployment.findFirst({
      where: { staffProfileId: staff.id, schoolId },
      select: employmentSelect,
    });

    return Response.json({ employment });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load staff employment details:", error);
    return Response.json(
      { error: "Unable to load employment details." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, staffId } = await context.params;

    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...managementRoles],
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "A valid employment update is required." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    const editableFields = [
      "employmentType",
      "startDate",
      "contractStartDate",
      "contractEndDate",
      "contractReference",
      "notes",
    ];

    const unsupported = Object.keys(data).filter(
      (key) => !editableFields.includes(key),
    );

    if (unsupported.length) {
      return Response.json(
        {
          error:
            "Unsupported fields. Employee identity, employment status, login access, and school roles cannot be changed here.",
        },
        { status: 400 },
      );
    }

    if (!Object.keys(data).length) {
      return Response.json(
        { error: "Provide at least one employment field to update." },
        { status: 400 },
      );
    }

    const update: Prisma.StaffEmploymentUncheckedCreateInput = {
      schoolId,
      staffProfileId: staffId,
    };

    if ("employmentType" in data) {
      if (
        typeof data.employmentType !== "string" ||
        !Object.values(EmploymentType).includes(
          data.employmentType as EmploymentType,
        )
      ) {
        return Response.json(
          { error: "Select a valid employment type." },
          { status: 400 },
        );
      }

      update.employmentType = data.employmentType as EmploymentType;
    }

    for (const field of [
      "startDate",
      "contractStartDate",
      "contractEndDate",
    ] as const) {
      if (!(field in data)) continue;

      const labels = {
        startDate: "Employment start date",
        contractStartDate: "Contract start date",
        contractEndDate: "Contract end date",
      };

      const parsed = parseDate(data[field], labels[field]);

      if ("error" in parsed) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }

      if (field === "startDate") update.startDate = parsed.value;
      if (field === "contractStartDate") {
        update.contractStartDate = parsed.value;
      }
      if (field === "contractEndDate") update.contractEndDate = parsed.value;
    }

    for (const field of ["contractReference", "notes"] as const) {
      if (!(field in data)) continue;

      const parsed = parseOptionalText(
        data[field],
        field === "contractReference" ? "Contract reference" : "Notes",
        field === "contractReference" ? 100 : 2000,
      );

      if ("error" in parsed) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }

      if (field === "contractReference") {
        update.contractReference = parsed.value;
      } else {
        update.notes = parsed.value;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const staff = await tx.staffProfile.findFirst({
        where: { id: staffId, schoolId },
        select: { id: true },
      });

      if (!staff) return { kind: "missing" as const };

      const existing = await tx.staffEmployment.findFirst({
        where: { staffProfileId: staff.id, schoolId },
        select: employmentSelect,
      });

      const merged = {
        employmentType:
          update.employmentType ?? existing?.employmentType ?? EmploymentType.PERMANENT,
        startDate:
          update.startDate !== undefined
            ? update.startDate
            : existing?.startDate ?? null,
        contractStartDate:
          update.contractStartDate !== undefined
            ? update.contractStartDate
            : existing?.contractStartDate ?? null,
        contractEndDate:
          update.contractEndDate !== undefined
            ? update.contractEndDate
            : existing?.contractEndDate ?? null,
      };

      if (
        merged.contractStartDate &&
        merged.contractEndDate &&
        merged.contractEndDate < merged.contractStartDate
      ) {
        return { kind: "invalid-dates" as const };
      }

      const employment = await tx.staffEmployment.upsert({
        where: { staffProfileId: staff.id },
        create: {
          schoolId,
          staffProfileId: staff.id,
          employmentType: merged.employmentType,
          startDate: merged.startDate,
          contractStartDate: merged.contractStartDate,
          contractEndDate: merged.contractEndDate,
          contractReference: update.contractReference ?? null,
          notes: update.notes ?? null,
        },
        update: {
          ...(update.employmentType !== undefined
            ? { employmentType: update.employmentType }
            : {}),
          ...(update.startDate !== undefined
            ? { startDate: update.startDate }
            : {}),
          ...(update.contractStartDate !== undefined
            ? { contractStartDate: update.contractStartDate }
            : {}),
          ...(update.contractEndDate !== undefined
            ? { contractEndDate: update.contractEndDate }
            : {}),
          ...(update.contractReference !== undefined
            ? { contractReference: update.contractReference }
            : {}),
          ...(update.notes !== undefined ? { notes: update.notes } : {}),
        },
        select: employmentSelect,
      });

      if (!existing) {
        const initialDetails = [
          `Employment type: ${employment.employmentType}`,
          employment.startDate
            ? `Employment start date: ${dateValue(employment.startDate)}`
            : null,
          employment.contractStartDate
            ? `Contract start date: ${dateValue(employment.contractStartDate)}`
            : null,
          employment.contractEndDate
            ? `Contract end date: ${dateValue(employment.contractEndDate)}`
            : null,
          employment.contractReference
            ? `Contract reference: ${employment.contractReference}`
            : null,
        ].filter(Boolean);

        await tx.staffEmploymentHistory.create({
          data: {
            schoolId,
            staffProfileId: staff.id,
            changeType: employment.contractStartDate
              ? EmploymentChangeType.CONTRACT_STARTED
              : EmploymentChangeType.CONTRACT_CHANGED,
            effectiveDate:
              employment.contractStartDate ??
              employment.startDate ??
              new Date(),
            description: `Initial employment details recorded. ${initialDetails.join("; ")}`,
            notes: employment.notes,
          },
        });
      }

      if (existing) {
        const typeChanged = existing.employmentType !== employment.employmentType;
        const startChanged =
          dateValue(existing.startDate) !== dateValue(employment.startDate);
        const contractStartChanged =
          dateValue(existing.contractStartDate) !== dateValue(employment.contractStartDate);
        const contractEndChanged =
          dateValue(existing.contractEndDate) !== dateValue(employment.contractEndDate);

        if (typeChanged || startChanged || contractStartChanged || contractEndChanged) {
          const changeType =
            contractStartChanged && !existing.contractStartDate
              ? EmploymentChangeType.CONTRACT_STARTED
              : EmploymentChangeType.CONTRACT_CHANGED;

          const details = [
            typeChanged
              ? `Employment type: ${existing.employmentType} → ${employment.employmentType}`
              : null,
            startChanged
              ? `Employment start date updated to ${dateValue(employment.startDate) ?? "not recorded"}`
              : null,
            contractStartChanged
              ? `Contract start date updated to ${dateValue(employment.contractStartDate) ?? "not recorded"}`
              : null,
            contractEndChanged
              ? `Contract end date updated to ${dateValue(employment.contractEndDate) ?? "not recorded"}`
              : null,
          ].filter(Boolean);

          await tx.staffEmploymentHistory.create({
            data: {
              schoolId,
              staffProfileId: staff.id,
              changeType,
              effectiveDate:
                employment.contractStartDate ??
                employment.startDate ??
                new Date(),
              description: details.join("; "),
              notes: update.notes !== undefined ? update.notes : existing.notes,
            },
          });
        }
      }

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SCHOOL_STAFF_EMPLOYMENT_UPDATED",
          resourceType: "StaffEmployment",
          resourceId: employment.id,
          metadata: {
            staffProfileId: staff.id,
            changedFields: Object.keys(data),
            created: !existing,
          },
        },
        request,
      );

      return { kind: "success" as const, employment };
    });

    if (result.kind === "missing") {
      return Response.json(
        { error: "Employee not found in this school." },
        { status: 404 },
      );
    }

    if (result.kind === "invalid-dates") {
      return Response.json(
        { error: "Contract end date cannot be earlier than contract start date." },
        { status: 400 },
      );
    }

    return Response.json({ employment: result.employment });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to save staff employment details:", error);
    return Response.json(
      { error: "Unable to save employment details." },
      { status: 500 },
    );
  }
}
