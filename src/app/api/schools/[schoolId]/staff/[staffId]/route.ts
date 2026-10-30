import { NextRequest } from "next/server";
import { EmploymentChangeType, Prisma, SchoolMembershipRole } from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string; staffId: string }>;
};

const staffManagementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const staffSelect = {
  id: true,
  employeeNumber: true,
  firstName: true,
  middleName: true,
  lastName: true,
  email: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  hireDate: true,
  jobTitle: true,
  department: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaffProfileSelect;

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

function parseDate(
  value: unknown,
  label: string,
): { value: Date | null } | { error: string } {
  if (value === null || value === "") return { value: null };

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return { error: `${label} must be a valid date in YYYY-MM-DD format or null.` };
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

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, staffId } = await context.params;

    await requireSchoolRole(
      request.headers,
      schoolId,
      [...staffManagementRoles],
    );

    const staff = await prisma.staffProfile.findFirst({
      where: { id: staffId, schoolId },
      select: staffSelect,
    });

    if (!staff) {
      return Response.json(
        { error: "Employee not found in this school." },
        { status: 404 },
      );
    }

    return Response.json({ staff });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load employee profile:", error);
    return Response.json(
      { error: "Unable to load the employee profile." },
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
      [...staffManagementRoles],
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
        { error: "A valid employee update is required." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    const editableFields = [
      "firstName",
      "middleName",
      "lastName",
      "email",
      "phone",
      "dateOfBirth",
      "gender",
      "hireDate",
    ];

    const unsupportedFields = Object.keys(data).filter(
      (key) => !editableFields.includes(key),
    );

    if (unsupportedFields.length > 0) {
      return Response.json(
        {
          error:
            "Unsupported fields. Job title and department changes must use the job-assignment approval workflow. Employee number, employment status, login credentials, and school roles cannot be changed through profile editing.",
        },
        { status: 400 },
      );
    }

    const update: Prisma.StaffProfileUpdateInput = {};

    for (const field of ["firstName", "middleName", "lastName"] as const) {
      if (!(field in data)) continue;

      if (typeof data[field] !== "string") {
        if (field === "middleName" && data[field] === null) {
          update.middleName = null;
          continue;
        }

        return Response.json(
          { error: `${field} must be text.` },
          { status: 400 },
        );
      }

      const value = (data[field] as string).trim();
      const label =
        field === "firstName"
          ? "First name"
          : field === "middleName"
            ? "Middle name"
            : "Last name";

      if (field !== "middleName" && !value) {
        return Response.json(
          { error: `${label} is required.` },
          { status: 400 },
        );
      }

      if (value.length > 80) {
        return Response.json(
          { error: `${label} must not exceed 80 characters.` },
          { status: 400 },
        );
      }

      if (field === "firstName") update.firstName = value;
      if (field === "middleName") update.middleName = value || null;
      if (field === "lastName") update.lastName = value;
    }

    for (const field of [
      "email",
      "phone",
      "jobTitle",
      "department",
      "gender",
    ] as const) {
      if (!(field in data)) continue;

      const labels = {
        email: "Contact email",
        phone: "Phone",
        jobTitle: "Job title",
        department: "Department",
        gender: "Gender",
      };

      const limits = {
        email: 254,
        phone: 100,
        jobTitle: 100,
        department: 100,
        gender: 50,
      };

      const parsed = parseOptionalText(
        data[field],
        labels[field],
        limits[field],
      );

      if ("error" in parsed) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }

      if (field === "email" && parsed.value) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.value)) {
          return Response.json(
            { error: "Enter a valid contact email address." },
            { status: 400 },
          );
        }
        update.email = parsed.value.toLowerCase();
      }

      if (field === "phone") update.phone = parsed.value;
      if (field === "jobTitle") update.jobTitle = parsed.value;
      if (field === "department") update.department = parsed.value;
      if (field === "gender") update.gender = parsed.value;
    }

    for (const field of ["dateOfBirth", "hireDate"] as const) {
      if (!(field in data)) continue;

      const parsed = parseDate(
        data[field],
        field === "dateOfBirth" ? "Date of birth" : "Hire date",
      );

      if ("error" in parsed) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }

      if (field === "dateOfBirth") update.dateOfBirth = parsed.value;
      if (field === "hireDate") update.hireDate = parsed.value;
    }

    if (Object.keys(update).length === 0) {
      return Response.json(
        { error: "Provide at least one supported field to update." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffProfile.findFirst({
        where: { id: staffId, schoolId },
        select: { id: true, jobTitle: true, department: true },
      });

      if (!existing) return null;

      const staff = await tx.staffProfile.update({
        where: { id: existing.id },
        data: update,
        select: staffSelect,
      });

      const titleChanged = existing.jobTitle !== staff.jobTitle;
      const departmentChanged = existing.department !== staff.department;

      if (titleChanged || departmentChanged) {
        await tx.staffEmploymentHistory.create({
          data: {
            schoolId,
            staffProfileId: staff.id,
            changeType:
              titleChanged && departmentChanged
                ? EmploymentChangeType.TRANSFER
                : titleChanged
                  ? EmploymentChangeType.ROLE_CHANGED
                  : EmploymentChangeType.DEPARTMENT_CHANGED,
            effectiveDate: new Date(),
            previousJobTitle: existing.jobTitle,
            newJobTitle: staff.jobTitle,
            previousDepartment: existing.department,
            newDepartment: staff.department,
            description: "Employment details updated through the employee profile.",
          },
        });
      }

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SCHOOL_STAFF_PROFILE_UPDATED",
          resourceType: "StaffProfile",
          resourceId: staff.id,
          metadata: {
            changedFields: Object.keys(update),
          },
        },
        request,
      );

      return staff;
    });

    if (!result) {
      return Response.json(
        { error: "Employee not found in this school." },
        { status: 404 },
      );
    }

    return Response.json({ staff: result });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to update employee profile:", error);
    return Response.json(
      { error: "Unable to update the employee profile." },
      { status: 500 },
    );
  }
}
