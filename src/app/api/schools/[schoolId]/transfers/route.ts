import { NextRequest } from "next/server";
import { EmploymentChangeType, StaffStatus } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = { params: Promise<{ schoolId: string }> };

const roles = ["OWNER", "ADMIN", "HR_MANAGER"] as const;
const activeStatuses = [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE];

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || null;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...roles]);

    const params = new URL(request.url).searchParams;
    const q = (params.get("q") ?? "").trim().slice(0, 100);
    const requestedLimit = Number(params.get("limit") ?? "100");
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(200, Math.max(1, requestedLimit))
      : 100;

    const employeeWhere = {
      schoolId,
      status: { in: activeStatuses },
      ...(q
        ? {
            OR: [
              { employeeNumber: { contains: q, mode: "insensitive" as const } },
              { firstName: { contains: q, mode: "insensitive" as const } },
              { middleName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { jobTitle: { contains: q, mode: "insensitive" as const } },
              { department: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [employees, transfers, totalTransfers, thisMonth] =
      await Promise.all([
        prisma.staffProfile.findMany({
          where: employeeWhere,
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          take: limit,
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
        }),
        prisma.staffEmploymentHistory.findMany({
          where: {
            schoolId,
            changeType: EmploymentChangeType.TRANSFER,
          },
          orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
          take: limit,
          select: {
            id: true,
            staffProfileId: true,
            effectiveDate: true,
            previousJobTitle: true,
            newJobTitle: true,
            previousDepartment: true,
            newDepartment: true,
            description: true,
            createdAt: true,
            staffProfile: {
              select: {
                employeeNumber: true,
                firstName: true,
                middleName: true,
                lastName: true,
                status: true,
              },
            },
          },
        }),
        prisma.staffEmploymentHistory.count({
          where: {
            schoolId,
            changeType: EmploymentChangeType.TRANSFER,
          },
        }),
        prisma.staffEmploymentHistory.count({
          where: {
            schoolId,
            changeType: EmploymentChangeType.TRANSFER,
            effectiveDate: {
              gte: new Date(Date.UTC(
                new Date().getUTCFullYear(),
                new Date().getUTCMonth(),
                1,
              )),
              lt: new Date(Date.UTC(
                new Date().getUTCFullYear(),
                new Date().getUTCMonth() + 1,
                1,
              )),
            },
          },
        }),
      ]);

    const departments = new Set<string>();
    for (const transfer of transfers) {
      if (transfer.previousDepartment) departments.add(transfer.previousDepartment);
      if (transfer.newDepartment) departments.add(transfer.newDepartment);
    }

    return Response.json({
      employees,
      transfers,
      metrics: {
        totalTransfers,
        effectiveThisMonth: thisMonth,
        departmentsInRecentTransfers: departments.size,
      },
      limit,
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load staff transfers:", error);
    return Response.json(
      { error: "Unable to load staff transfers." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...roles],
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
        { error: "A valid transfer is required." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    const allowed = [
      "staffProfileId",
      "newJobTitle",
      "newDepartment",
      "effectiveDate",
      "reason",
    ];

    if (Object.keys(data).some((key) => !allowed.includes(key))) {
      return Response.json(
        { error: "Unexpected transfer fields were submitted." },
        { status: 400 },
      );
    }

    const staffProfileId =
      typeof data.staffProfileId === "string"
        ? data.staffProfileId.trim()
        : "";
    const newJobTitle = nullableText(data.newJobTitle);
    const newDepartment = nullableText(data.newDepartment);
    const reason =
      typeof data.reason === "string" ? data.reason.trim() : "";
    const effectiveDate = validDate(data.effectiveDate);

    if (!staffProfileId) {
      return Response.json(
        { error: "Select an employee." },
        { status: 400 },
      );
    }

    if (
      typeof newJobTitle !== "string" ||
      !newJobTitle ||
      newJobTitle.length > 150
    ) {
      return Response.json(
        { error: "A new job title is required and must not exceed 150 characters." },
        { status: 400 },
      );
    }

    if (
      newDepartment === undefined ||
      (typeof newDepartment === "string" && newDepartment.length > 150)
    ) {
      return Response.json(
        { error: "Department must be text of at most 150 characters or empty." },
        { status: 400 },
      );
    }

    if (!effectiveDate) {
      return Response.json(
        { error: "Enter a valid effective date." },
        { status: 400 },
      );
    }

    if (reason.length < 3 || reason.length > 1000) {
      return Response.json(
        { error: "Reason must be between 3 and 1000 characters." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.staffProfile.findFirst({
        where: {
          id: staffProfileId,
          schoolId,
          status: { in: activeStatuses },
        },
        select: {
          id: true,
          employeeNumber: true,
          jobTitle: true,
          department: true,
          status: true,
        },
      });

      if (!employee) return { kind: "missing" as const };

      if (
        (employee.jobTitle ?? null) === newJobTitle &&
        (employee.department ?? null) === newDepartment
      ) {
        return { kind: "unchanged" as const };
      }

      const updated = await tx.staffProfile.updateMany({
        where: {
          id: employee.id,
          schoolId,
          status: employee.status,
          jobTitle: employee.jobTitle,
          department: employee.department,
        },
        data: {
          jobTitle: newJobTitle,
          department: newDepartment,
        },
      });

      if (updated.count !== 1) return { kind: "conflict" as const };

      const history = await tx.staffEmploymentHistory.create({
        data: {
          schoolId,
          staffProfileId: employee.id,
          changeType: EmploymentChangeType.TRANSFER,
          effectiveDate,
          previousJobTitle: employee.jobTitle,
          newJobTitle,
          previousDepartment: employee.department,
          newDepartment,
          description: reason,
          notes: `Transfer recorded by ${authorization.userId}`,
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SCHOOL_STAFF_TRANSFERRED",
          resourceType: "StaffEmploymentHistory",
          resourceId: history.id,
          metadata: {
            staffProfileId: employee.id,
            employeeNumber: employee.employeeNumber,
            previousJobTitle: employee.jobTitle,
            newJobTitle,
            previousDepartment: employee.department,
            newDepartment,
            effectiveDate: effectiveDate.toISOString(),
          },
        },
        request,
      );

      return { kind: "success" as const, history };
    });

    if (result.kind === "missing") {
      return Response.json(
        { error: "Active employee not found in this school." },
        { status: 404 },
      );
    }

    if (result.kind === "unchanged") {
      return Response.json(
        { error: "The new job title and department match the employee's current assignment." },
        { status: 400 },
      );
    }

    if (result.kind === "conflict") {
      return Response.json(
        { error: "The employee record changed concurrently. Refresh and try again." },
        { status: 409 },
      );
    }

    return Response.json({ transfer: result.history }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to record staff transfer:", error);
    return Response.json(
      { error: "Unable to record the staff transfer." },
      { status: 500 },
    );
  }
}
