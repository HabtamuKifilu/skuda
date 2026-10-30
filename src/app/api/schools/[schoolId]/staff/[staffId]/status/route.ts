import { NextRequest } from "next/server";
import { StaffStatus } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string; staffId: string }>;
};

const managementRoles = ["OWNER", "ADMIN", "HR_MANAGER"] as const;

const transitions: Record<StaffStatus, StaffStatus[]> = {
  ACTIVE: [
    StaffStatus.ON_LEAVE,
    StaffStatus.SUSPENDED,
    StaffStatus.INACTIVE,
  ],
  ON_LEAVE: [
    StaffStatus.ACTIVE,
    StaffStatus.SUSPENDED,
    StaffStatus.INACTIVE,
  ],
  SUSPENDED: [
    StaffStatus.ACTIVE,
    StaffStatus.ON_LEAVE,
    StaffStatus.INACTIVE,
  ],
  INACTIVE: [
    StaffStatus.ACTIVE,
    StaffStatus.ON_LEAVE,
    StaffStatus.SUSPENDED,
  ],
  TERMINATED: [],
};

const statusLabels: Record<StaffStatus, string> = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  SUSPENDED: "Suspended",
  INACTIVE: "Inactive",
  TERMINATED: "Terminated",
};

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
        { error: "A valid status change is required." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    if (Object.keys(data).some((key) => !["status", "reason"].includes(key))) {
      return Response.json(
        { error: "Only status and reason can be submitted." },
        { status: 400 },
      );
    }

    if (
      typeof data.status !== "string" ||
      !Object.values(StaffStatus).includes(data.status as StaffStatus)
    ) {
      return Response.json(
        { error: "Select a valid employee status." },
        { status: 400 },
      );
    }

    const nextStatus = data.status as StaffStatus;
    const reason =
      typeof data.reason === "string" ? data.reason.trim() : "";

    if (reason.length > 500) {
      return Response.json(
        { error: "The reason must not exceed 500 characters." },
        { status: 400 },
      );
    }

    if (nextStatus === StaffStatus.TERMINATED) {
      return Response.json(
        {
          error:
            "Employee termination must be completed through the offboarding workflow.",
        },
        { status: 409 },
      );
    }

    if (
      (
        nextStatus === StaffStatus.SUSPENDED ||
        nextStatus === StaffStatus.INACTIVE
      ) &&
      reason.length < 3
    ) {
      return Response.json(
        {
          error:
            "Provide a reason of at least 3 characters for suspension or inactivity.",
        },
        { status: 400 },
      );
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const employee = await tx.staffProfile.findFirst({
        where: { id: staffId, schoolId },
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          middleName: true,
          lastName: true,
          status: true,
          userId: true,
        },
      });

      if (!employee) return { kind: "not-found" } as const;

      if (employee.status === nextStatus) {
        return { kind: "unchanged" } as const;
      }

      if (!transitions[employee.status].includes(nextStatus)) {
        return {
          kind: "invalid-transition",
          currentStatus: employee.status,
        } as const;
      }

      const updated = await tx.staffProfile.updateMany({
        where: {
          id: staffId,
          schoolId,
          status: employee.status,
        },
        data: { status: nextStatus },
      });

      if (updated.count !== 1) {
        return { kind: "conflict" } as const;
      }

      const employeeName = [
        employee.firstName,
        employee.middleName,
        employee.lastName,
      ].filter(Boolean).join(" ");

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SCHOOL_STAFF_STATUS_CHANGED",
          resourceType: "StaffProfile",
          resourceId: employee.id,
          metadata: {
            employeeNumber: employee.employeeNumber,
            employeeName,
            previousStatus: employee.status,
            newStatus: nextStatus,
            ...(reason ? { reason } : {}),
          },
        },
        request,
      );

      return {
        kind: "updated",
        employeeName,
        previousStatus: employee.status,
        status: nextStatus,
      } as const;
    });

    if (outcome.kind === "not-found") {
      return Response.json(
        { error: "Employee not found in this school." },
        { status: 404 },
      );
    }

    if (outcome.kind === "unchanged") {
      return Response.json(
        { error: "The employee already has that status." },
        { status: 409 },
      );
    }

    if (outcome.kind === "invalid-transition") {
      return Response.json(
        {
          error:
            outcome.currentStatus === StaffStatus.TERMINATED
              ? "Terminated employees cannot be reactivated through this workflow."
              : "That status transition is not permitted.",
        },
        { status: 409 },
      );
    }

    if (outcome.kind === "conflict") {
      return Response.json(
        {
          error:
            "The employee status changed concurrently. Refresh and try again.",
        },
        { status: 409 },
      );
    }

    return Response.json({
      message: `Employee status changed from ${statusLabels[outcome.previousStatus]} to ${statusLabels[outcome.status]}.`,
      staff: {
        id: staffId,
        name: outcome.employeeName,
        status: outcome.status,
      },
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to change employee status:", error);
    return Response.json(
      { error: "Unable to update the employee status." },
      { status: 500 },
    );
  }
}
