import { NextRequest } from "next/server";
import {
  SchoolMembershipRole,
  StaffJobAssignmentRequestStatus,
  StaffStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ schoolId: string }>;
};

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

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

function parseBody(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...roles]);

    const statusParam = request.nextUrl.searchParams.get("status");
    const status = statusParam &&
      Object.values(StaffJobAssignmentRequestStatus).includes(
        statusParam as StaffJobAssignmentRequestStatus,
      )
      ? statusParam as StaffJobAssignmentRequestStatus
      : undefined;

    if (statusParam && !status) {
      return Response.json({ error: "Invalid request status filter." }, { status: 400 });
    }

    const requests = await prisma.staffJobAssignmentRequest.findMany({
      where: { schoolId, ...(status ? { status } : {}) },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        staffProfile: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            status: true,
            jobTitle: true,
            department: true,
          },
        },
        jobTitle: { select: { id: true, name: true, isActive: true } },
        department: { select: { id: true, name: true, isActive: true } },
        reportingManager: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
        requestedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return Response.json({ requests });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to load job assignment requests:", error);
    return Response.json({ error: "Unable to load assignment requests." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(request.headers, schoolId, [...roles]);

    let body: Record<string, unknown> | null;
    try {
      body = parseBody(await request.json());
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const allowedKeys = [
      "staffProfileId",
      "jobTitleId",
      "departmentId",
      "reportingManagerId",
      "effectiveDate",
      "reason",
    ];

    if (
      !body ||
      Object.keys(body).some((key) => !allowedKeys.includes(key)) ||
      typeof body.staffProfileId !== "string" ||
      !body.staffProfileId.trim() ||
      typeof body.jobTitleId !== "string" ||
      !body.jobTitleId.trim() ||
      typeof body.reason !== "string" ||
      !body.reason.trim() ||
      body.reason.trim().length > 2000 ||
      (body.departmentId !== undefined &&
        body.departmentId !== null &&
        typeof body.departmentId !== "string") ||
      (body.reportingManagerId !== undefined &&
        body.reportingManagerId !== null &&
        typeof body.reportingManagerId !== "string")
    ) {
      return Response.json(
        { error: "Provide an employee, job title, effective date, and reason (up to 2,000 characters). Department and reporting manager are optional." },
        { status: 400 },
      );
    }

    const effectiveDate = validDate(body.effectiveDate);
    if (!effectiveDate) {
      return Response.json({ error: "Enter a valid effective date." }, { status: 400 });
    }

    const staffProfileId = body.staffProfileId.trim();
    const jobTitleId = body.jobTitleId.trim();
    const departmentId =
      typeof body.departmentId === "string" && body.departmentId.trim()
        ? body.departmentId.trim()
        : null;
    const reportingManagerId =
      typeof body.reportingManagerId === "string" && body.reportingManagerId.trim()
        ? body.reportingManagerId.trim()
        : null;
    const reason = body.reason.trim();

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.staffProfile.findFirst({
        where: { id: staffProfileId, schoolId, status: StaffStatus.ACTIVE },
        select: { id: true, employeeNumber: true, firstName: true, lastName: true },
      });

      if (!employee) {
        return { error: "Active employee not found in this school.", status: 404 as const };
      }

      const title = await tx.jobTitle.findFirst({
        where: { id: jobTitleId, schoolId, isActive: true },
        select: { id: true, name: true },
      });

      if (!title) {
        return { error: "Active job title not found in this school.", status: 400 as const };
      }

      if (departmentId) {
        const department = await tx.department.findFirst({
          where: { id: departmentId, schoolId, isActive: true },
          select: { id: true },
        });

        if (!department) {
          return { error: "Active department not found in this school.", status: 400 as const };
        }
      }

      if (reportingManagerId) {
        if (reportingManagerId === employee.id) {
          return { error: "An employee cannot be their own reporting manager.", status: 400 as const };
        }

        const manager = await tx.staffProfile.findFirst({
          where: {
            id: reportingManagerId,
            schoolId,
            status: StaffStatus.ACTIVE,
          },
          select: { id: true },
        });

        if (!manager) {
          return { error: "Active reporting manager not found in this school.", status: 400 as const };
        }
      }

      const pending = await tx.staffJobAssignmentRequest.findFirst({
        where: {
          schoolId,
          staffProfileId: employee.id,
          status: StaffJobAssignmentRequestStatus.PENDING,
        },
        select: { id: true },
      });

      if (pending) {
        return {
          error: "This employee already has a pending job assignment request.",
          status: 409 as const,
        };
      }

      const assignmentRequest = await tx.staffJobAssignmentRequest.create({
        data: {
          schoolId,
          staffProfileId: employee.id,
          jobTitleId: title.id,
          departmentId,
          reportingManagerId,
          effectiveDate,
          reason,
          requestedById: authorization.userId,
        },
        include: {
          staffProfile: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
          jobTitle: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          reportingManager: {
            select: {
              id: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_JOB_ASSIGNMENT_REQUESTED",
          resourceType: "StaffJobAssignmentRequest",
          resourceId: assignmentRequest.id,
          metadata: {
            staffProfileId: employee.id,
            employeeNumber: employee.employeeNumber,
            jobTitleId: title.id,
            effectiveDate: effectiveDate.toISOString(),
          },
        },
        request,
      );

      return { assignmentRequest };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ request: result.assignmentRequest }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to create job assignment request:", error);
    return Response.json({ error: "Unable to submit the assignment request." }, { status: 500 });
  }
}
