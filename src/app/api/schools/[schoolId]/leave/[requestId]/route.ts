import { NextRequest } from "next/server";
import {
  SchoolMembershipRole,
  StaffLeaveRequestStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import {
  requireSchoolMembership,
  requireSchoolRole,
} from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ schoolId: string; requestId: string }>;
};

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
] as const;

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, requestId } = await context.params;
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
        { error: "A valid review decision is required." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    if (
      Object.keys(data).some((key) => !["status", "reviewNotes"].includes(key)) ||
      !(
        data.status === StaffLeaveRequestStatus.APPROVED ||
        data.status === StaffLeaveRequestStatus.REJECTED
      ) ||
      (data.reviewNotes !== undefined &&
        typeof data.reviewNotes !== "string")
    ) {
      return Response.json(
        { error: "Choose APPROVED or REJECTED and provide valid review notes." },
        { status: 400 },
      );
    }

    const reviewNotes =
      typeof data.reviewNotes === "string" ? data.reviewNotes.trim() : "";

    if (reviewNotes.length > 2000) {
      return Response.json(
        { error: "Review notes cannot exceed 2,000 characters." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffLeaveRequest.findFirst({
        where: { id: requestId, schoolId },
        select: {
          id: true,
          status: true,
          requestedById: true,
          staffProfileId: true,
          startDate: true,
          endDate: true,
        },
      });

      if (!existing) {
        return {
          error: "Leave request not found in this school.",
          status: 404 as const,
        };
      }

      if (existing.requestedById === authorization.userId) {
        return {
          error: "You cannot approve or reject your own leave request.",
          status: 403 as const,
        };
      }

      if (existing.status !== StaffLeaveRequestStatus.PENDING) {
        return {
          error: "Only pending leave requests can be reviewed.",
          status: 409 as const,
        };
      }

      if (data.status === StaffLeaveRequestStatus.APPROVED) {
        const overlapping = await tx.staffLeaveRequest.findFirst({
          where: {
            schoolId,
            staffProfileId: existing.staffProfileId,
            id: { not: existing.id },
            status: StaffLeaveRequestStatus.APPROVED,
            startDate: { lte: existing.endDate },
            endDate: { gte: existing.startDate },
          },
          select: { id: true },
        });

        if (overlapping) {
          return {
            error: "This employee already has approved leave overlapping these dates.",
            status: 409 as const,
          };
        }
      }

      const updated = await tx.staffLeaveRequest.updateMany({
        where: {
          id: requestId,
          schoolId,
          status: StaffLeaveRequestStatus.PENDING,
        },
        data: {
          status: data.status as StaffLeaveRequestStatus,
          reviewedById: authorization.userId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null,
        },
      });

      if (updated.count !== 1) {
        return {
          error: "This leave request has already been reviewed.",
          status: 409 as const,
        };
      }

      const leaveRequest = await tx.staffLeaveRequest.findFirstOrThrow({
        where: { id: requestId, schoolId },
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
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
          reviewedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action:
            data.status === StaffLeaveRequestStatus.APPROVED
              ? "STAFF_LEAVE_REQUEST_APPROVED"
              : "STAFF_LEAVE_REQUEST_REJECTED",
          resourceType: "StaffLeaveRequest",
          resourceId: leaveRequest.id,
          metadata: {
            staffProfileId: existing.staffProfileId,
            previousStatus: existing.status,
            status: leaveRequest.status,
            reviewNotes: reviewNotes || null,
          },
        },
        request,
      );

      return { leaveRequest };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return Response.json({ request: result.leaveRequest });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return Response.json(
        { error: "A concurrent leave review conflicted with this decision. Refresh and try again." },
        { status: 409 },
      );
    }

    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to review staff leave request:", error);
    return Response.json(
      { error: "Unable to review the leave request." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { schoolId, requestId } = await context.params;
    const authorization = await requireSchoolMembership(
      request.headers,
      schoolId,
    );

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffLeaveRequest.findFirst({
        where: { id: requestId, schoolId },
        select: {
          id: true,
          status: true,
          requestedById: true,
          staffProfileId: true,
        },
      });

      if (!existing) {
        return {
          error: "Leave request not found in this school.",
          status: 404 as const,
        };
      }

      if (existing.requestedById !== authorization.userId) {
        return {
          error: "You can only cancel leave requests you submitted.",
          status: 403 as const,
        };
      }

      if (existing.status !== StaffLeaveRequestStatus.PENDING) {
        return {
          error: "Only pending leave requests can be cancelled.",
          status: 409 as const,
        };
      }

      const updated = await tx.staffLeaveRequest.updateMany({
        where: {
          id: requestId,
          schoolId,
          requestedById: authorization.userId,
          status: StaffLeaveRequestStatus.PENDING,
        },
        data: { status: StaffLeaveRequestStatus.CANCELLED },
      });

      if (updated.count !== 1) {
        return {
          error: "This leave request can no longer be cancelled.",
          status: 409 as const,
        };
      }

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_LEAVE_REQUEST_CANCELLED",
          resourceType: "StaffLeaveRequest",
          resourceId: existing.id,
          metadata: {
            staffProfileId: existing.staffProfileId,
            previousStatus: existing.status,
            status: StaffLeaveRequestStatus.CANCELLED,
          },
        },
        request,
      );

      return { success: true };
    });

    if ("error" in result) {
      return Response.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to cancel staff leave request:", error);
    return Response.json(
      { error: "Unable to cancel the leave request." },
      { status: 500 },
    );
  }
}
