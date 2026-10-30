import { NextRequest } from "next/server";
import { SchoolMembershipRole, StaffStatus } from "@/generated/prisma/enums";
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

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...roles]);

    const plans = await prisma.staffOnboarding.findMany({
      where: { schoolId },
      orderBy: [{ completedAt: "asc" }, { startDate: "desc" }],
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
        tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
    });

    const eligibleEmployees = await prisma.staffProfile.findMany({
      where: {
        schoolId,
        status: StaffStatus.ACTIVE,
        onboarding: null,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        jobTitle: true,
        department: true,
      },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return Response.json({
      plans,
      eligibleEmployees,
      stats: {
        total: plans.length,
        completed: plans.filter((p) => p.completedAt).length,
        overdue: plans.filter(
          (p) => !p.completedAt && p.targetCompletionDate &&
            p.targetCompletionDate < today,
        ).length,
        inProgress: plans.filter((p) => !p.completedAt).length,
      },
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to load onboarding plans:", error);
    return Response.json({ error: "Unable to load onboarding plans." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers, schoolId, [...roles],
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "A valid onboarding plan is required." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    if (
      Object.keys(data).some((key) =>
        !["staffProfileId", "startDate", "targetCompletionDate", "notes"].includes(key),
      ) ||
      typeof data.staffProfileId !== "string" ||
      !data.staffProfileId.trim()
    ) {
      return Response.json({ error: "Provide a valid employee." }, { status: 400 });
    }

    const startDate = validDate(data.startDate);
    const targetDate = data.targetCompletionDate
      ? validDate(data.targetCompletionDate)
      : null;
    const notes = typeof data.notes === "string" ? data.notes.trim() : "";

    if (!startDate || (data.targetCompletionDate && !targetDate)) {
      return Response.json({ error: "Enter valid onboarding dates." }, { status: 400 });
    }
    if (targetDate && targetDate < startDate) {
      return Response.json({ error: "Target date cannot precede the start date." }, { status: 400 });
    }
    if (notes.length > 2000) {
      return Response.json({ error: "Notes cannot exceed 2,000 characters." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.staffProfile.findFirst({
        where: {
          id: data.staffProfileId as string,
          schoolId,
          status: StaffStatus.ACTIVE,
        },
        select: { id: true, firstName: true, lastName: true, employeeNumber: true },
      });
      if (!employee) return { error: "Active employee not found in this school.", status: 404 as const };

      const existing = await tx.staffOnboarding.findFirst({
        where: { schoolId, staffProfileId: employee.id },
        select: { id: true },
      });
      if (existing) return { error: "This employee already has an onboarding plan.", status: 409 as const };

      const plan = await tx.staffOnboarding.create({
        data: {
          schoolId,
          staffProfileId: employee.id,
          startDate,
          targetCompletionDate: targetDate,
          notes: notes || null,
        },
        include: {
          staffProfile: {
            select: {
              id: true, employeeNumber: true, firstName: true,
              middleName: true, lastName: true, jobTitle: true,
              department: true, status: true,
            },
          },
          tasks: true,
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_ONBOARDING_CREATED",
        resourceType: "StaffOnboarding",
        resourceId: plan.id,
        metadata: { staffProfileId: employee.id, employeeNumber: employee.employeeNumber },
      }, request);

      return { plan };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({ plan: result.plan }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to create onboarding plan:", error);
    return Response.json({ error: "Unable to create onboarding plan." }, { status: 500 });
  }
}
