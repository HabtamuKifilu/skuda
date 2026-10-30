import { NextRequest } from "next/server";
import { EmploymentChangeType, StaffStatus } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = { params: Promise<{ schoolId: string }> };
const roles = ["OWNER", "ADMIN", "HR_MANAGER"] as const;

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...roles]);
    const params = new URL(request.url).searchParams;
    const q = (params.get("q") ?? "").trim().slice(0, 100);
    const [employees, history] = await Promise.all([
      prisma.staffProfile.findMany({
        where: {
          schoolId,
          status: { in: [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE] },
          ...(q ? { OR: [
            { employeeNumber: { contains: q, mode: "insensitive" as const } },
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { jobTitle: { contains: q, mode: "insensitive" as const } },
            { department: { contains: q, mode: "insensitive" as const } },
          ] } : {}),
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 200,
        select: {
          id: true, employeeNumber: true, firstName: true, middleName: true,
          lastName: true, jobTitle: true, department: true, status: true,
        },
      }),
      prisma.staffEmploymentHistory.findMany({
        where: { schoolId, changeType: EmploymentChangeType.PROMOTION },
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
        take: 200,
        select: {
          id: true, staffProfileId: true, effectiveDate: true,
          previousJobTitle: true, newJobTitle: true,
          previousDepartment: true, newDepartment: true,
          description: true, notes: true, createdAt: true,
          staffProfile: {
            select: { employeeNumber: true, firstName: true, middleName: true, lastName: true },
          },
        },
      }),
    ]);
    return Response.json({ employees, promotions: history });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to process staff promotion request:", error);
    return Response.json(
      { error: "Unable to process the promotion request." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(request.headers, schoolId, [...roles]);
    let body: unknown;
    try { body = await request.json(); }
    catch { return Response.json({ error: "Invalid JSON request body." }, { status: 400 }); }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "A valid promotion is required." }, { status: 400 });
    }
    const data = body as Record<string, unknown>;
    const allowed = ["staffProfileId", "newJobTitle", "newDepartment", "effectiveDate", "reason"];
    if (Object.keys(data).some((key) => !allowed.includes(key))) {
      return Response.json({ error: "Unexpected promotion fields were submitted." }, { status: 400 });
    }

    const staffProfileId = typeof data.staffProfileId === "string" ? data.staffProfileId.trim() : "";
    const newJobTitle = typeof data.newJobTitle === "string" ? data.newJobTitle.trim() : "";
    const newDepartment = data.newDepartment === null || data.newDepartment === ""
      ? null : typeof data.newDepartment === "string" ? data.newDepartment.trim() : undefined;
    const reason = typeof data.reason === "string" ? data.reason.trim() : "";
    const effectiveDate = validDate(data.effectiveDate);

    if (!staffProfileId) return Response.json({ error: "Select an employee." }, { status: 400 });
    if (!newJobTitle || newJobTitle.length > 150) {
      return Response.json({ error: "New job title is required and must not exceed 150 characters." }, { status: 400 });
    }
    if (newDepartment === undefined || (newDepartment && newDepartment.length > 150)) {
      return Response.json({ error: "Department must be text of at most 150 characters or empty." }, { status: 400 });
    }
    if (!effectiveDate) return Response.json({ error: "Enter a valid effective date." }, { status: 400 });
    if (reason.length < 3 || reason.length > 1000) {
      return Response.json({ error: "Reason must be between 3 and 1000 characters." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.staffProfile.findFirst({
        where: {
          id: staffProfileId, schoolId,
          status: { in: [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE] },
        },
        select: {
          id: true, employeeNumber: true, firstName: true, lastName: true,
          jobTitle: true, department: true, status: true,
        },
      });
      if (!employee) return { kind: "missing" as const };

      const title = newJobTitle;
      const department = newDepartment;
      if (employee.jobTitle?.trim() === title &&
          (employee.department ?? null) === department) {
        return { kind: "unchanged" as const };
      }

      const updated = await tx.staffProfile.updateMany({
        where: {
          id: employee.id, schoolId, status: employee.status,
          jobTitle: employee.jobTitle, department: employee.department,
        },
        data: { jobTitle: title, department },
      });
      if (updated.count !== 1) return { kind: "conflict" as const };

      const history = await tx.staffEmploymentHistory.create({
        data: {
          schoolId,
          staffProfileId: employee.id,
          changeType: EmploymentChangeType.PROMOTION,
          effectiveDate,
          previousJobTitle: employee.jobTitle,
          newJobTitle: title,
          previousDepartment: employee.department,
          newDepartment: department,
          description: reason,
          notes: `Promotion recorded by ${authorization.userId}`,
        },
      });
      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "SCHOOL_STAFF_PROMOTED",
        resourceType: "StaffEmploymentHistory",
        resourceId: history.id,
        metadata: {
          staffProfileId: employee.id,
          previousJobTitle: employee.jobTitle,
          newJobTitle: title,
          previousDepartment: employee.department,
          newDepartment: department,
          effectiveDate: effectiveDate.toISOString(),
        },
      }, request);
      return { kind: "success" as const, history };
    });

    if (result.kind === "missing") {
      return Response.json({ error: "Active employee not found in this school." }, { status: 404 });
    }
    if (result.kind === "unchanged") {
      return Response.json({ error: "The new title and department match the employee's current assignment." }, { status: 400 });
    }
    if (result.kind === "conflict") {
      return Response.json({ error: "The employee record changed concurrently. Refresh and try again." }, { status: 409 });
    }
    return Response.json({ promotion: result.history }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to process staff promotion request:", error);
    return Response.json(
      { error: "Unable to process the promotion request." },
      { status: 500 },
    );
  }
}
