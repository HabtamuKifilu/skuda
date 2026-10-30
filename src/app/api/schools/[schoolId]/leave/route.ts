import { NextRequest } from "next/server";
import {
  SchoolMembershipRole,
  StaffLeaveRequestStatus,
  StaffLeaveType,
  StaffStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import {
  requireSchoolMembership,
} from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ schoolId: string }>;
};

const hrRoles: SchoolMembershipRole[] = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
];

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

function isHr(roles: SchoolMembershipRole[]) {
  return roles.some((role) => hrRoles.includes(role));
}

const leaveInclude = {
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
} as const;

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolMembership(
      request.headers,
      schoolId,
    );

    const where = isHr(authorization.roles)
      ? { schoolId }
      : {
          schoolId,
          staffProfile: { userId: authorization.userId },
        };

    const requests = await prisma.staffLeaveRequest.findMany({
      where,
      include: leaveInclude,
      orderBy: [{ createdAt: "desc" }],
    });

    return Response.json({ requests });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load staff leave requests:", error);
    return Response.json(
      { error: "Unable to load staff leave requests." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolMembership(
      request.headers,
      schoolId,
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
        { error: "A valid leave request is required." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    const allowedKeys = [
      "staffProfileId",
      "leaveType",
      "startDate",
      "endDate",
      "reason",
    ];

    if (
      Object.keys(data).some((key) => !allowedKeys.includes(key)) ||
      typeof data.leaveType !== "string" ||
      !Object.values(StaffLeaveType).includes(data.leaveType as StaffLeaveType) ||
      typeof data.reason !== "string" ||
      !data.reason.trim() ||
      data.reason.trim().length > 2000
    ) {
      return Response.json(
        { error: "Provide a valid leave type and reason (maximum 2,000 characters)." },
        { status: 400 },
      );
    }

    const startDate = validDate(data.startDate);
    const endDate = validDate(data.endDate);

    if (!startDate || !endDate) {
      return Response.json(
        { error: "Enter valid start and end dates." },
        { status: 400 },
      );
    }

    if (endDate < startDate) {
      return Response.json(
        { error: "End date cannot precede the start date." },
        { status: 400 },
      );
    }

    const staffProfileIdProvided =
      typeof data.staffProfileId === "string" &&
      data.staffProfileId.trim().length > 0;

    let staffProfileId: string;

    if (isHr(authorization.roles)) {
      if (!staffProfileIdProvided) {
        return Response.json(
          { error: "Select an employee for this leave request." },
          { status: 400 },
        );
      }
      staffProfileId = (data.staffProfileId as string).trim();
    } else {
      const ownProfile = await prisma.staffProfile.findFirst({
        where: {
          schoolId,
          userId: authorization.userId,
          status: StaffStatus.ACTIVE,
        },
        select: { id: true },
      });

      if (!ownProfile) {
        return Response.json(
          { error: "No active employee profile is linked to your account." },
          { status: 403 },
        );
      }

      if (
        staffProfileIdProvided &&
        data.staffProfileId !== ownProfile.id
      ) {
        return Response.json(
          { error: "You can only submit leave for your own employee profile." },
          { status: 403 },
        );
      }

      staffProfileId = ownProfile.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.staffProfile.findFirst({
        where: {
          id: staffProfileId,
          schoolId,
          status: StaffStatus.ACTIVE,
        },
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          userId: true,
        },
      });

      if (!employee) {
        return {
          error: "Active employee not found in this school.",
          status: 404 as const,
        };
      }

      if (
        !isHr(authorization.roles) &&
        employee.userId !== authorization.userId
      ) {
        return {
          error: "You can only submit leave for your own employee profile.",
          status: 403 as const,
        };
      }

      const overlapping = await tx.staffLeaveRequest.findFirst({
        where: {
          schoolId,
          staffProfileId: employee.id,
          status: {
            in: [
              StaffLeaveRequestStatus.PENDING,
              StaffLeaveRequestStatus.APPROVED,
            ],
          },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true },
      });

      if (overlapping) {
        return {
          error: "These dates overlap an existing pending or approved leave request.",
          status: 409 as const,
        };
      }

      const leaveRequest = await tx.staffLeaveRequest.create({
        data: {
          schoolId,
          staffProfileId: employee.id,
          leaveType: data.leaveType as StaffLeaveType,
          startDate,
          endDate,
          reason: (data.reason as string).trim(),
          status: StaffLeaveRequestStatus.PENDING,
          requestedById: authorization.userId,
        },
        include: leaveInclude,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_LEAVE_REQUEST_CREATED",
          resourceType: "StaffLeaveRequest",
          resourceId: leaveRequest.id,
          metadata: {
            staffProfileId: employee.id,
            employeeNumber: employee.employeeNumber,
            leaveType: leaveRequest.leaveType,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
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

    return Response.json(
      { request: result.leaveRequest },
      { status: 201 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return Response.json(
        { error: "A concurrent leave request conflicted with this submission. Refresh and try again." },
        { status: 409 },
      );
    }

    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to create staff leave request:", error);
    return Response.json(
      { error: "Unable to create the leave request." },
      { status: 500 },
    );
  }
}
