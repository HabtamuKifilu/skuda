import { NextRequest, NextResponse } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const MANAGERS = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

type Context = { params: Promise<{ schoolId: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function optionalText(value: unknown, max: number, field: string) {
  if (value === undefined || value === null || value === "") {
    return { value: null as string | null };
  }
  if (typeof value !== "string" || value.trim().length > max) {
    return { error: `${field} must be text of at most ${max} characters.` };
  }
  return { value: value.trim() || null };
}

function errorResponse(error: unknown) {
  const response = authorizationErrorResponse(error);
  if (response) return response;
  console.error("Staff development API error:", error);
  return NextResponse.json({ error: "Unable to process staff development request." }, { status: 500 });
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

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...MANAGERS]);

    const [plans, employees] = await Promise.all([
      prisma.staffDevelopmentPlan.findMany({
        where: { schoolId },
        orderBy: [{ createdAt: "desc" }],
        include: {
          staffProfile: { select: employeeSelect },
          createdBy: { select: { id: true, name: true, email: true } },
          goals: { orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
        },
      }),
      prisma.staffProfile.findMany({
        where: { schoolId, status: "ACTIVE" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: employeeSelect,
      }),
    ]);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const stats = {
      total: plans.length,
      draft: plans.filter((p) => p.status === "DRAFT").length,
      active: plans.filter((p) => p.status === "ACTIVE").length,
      completed: plans.filter((p) => p.status === "COMPLETED").length,
      cancelled: plans.filter((p) => p.status === "CANCELLED").length,
      overdue: plans.filter(
        (p) => p.status === "ACTIVE" && p.targetDate !== null && p.targetDate < today,
      ).length,
      totalGoals: plans.reduce((sum, p) => sum + p.goals.length, 0),
      completedGoals: plans.reduce(
        (sum, p) => sum + p.goals.filter((g) => g.progress === 100).length,
        0,
      ),
    };

    return NextResponse.json({ plans, employees, stats });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(request.headers, schoolId, [...MANAGERS]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!isRecord(body)) {
      return NextResponse.json({ error: "A development plan is required." }, { status: 400 });
    }

    const allowed = ["staffProfileId", "title", "description", "startDate", "targetDate", "notes"];
    if (Object.keys(body).some((key) => !allowed.includes(key))) {
      return NextResponse.json({ error: "The request contains unsupported fields." }, { status: 400 });
    }

    if (
      typeof body.staffProfileId !== "string" || !body.staffProfileId.trim() ||
      typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 160
    ) {
      return NextResponse.json(
        { error: "Select an employee and enter a title up to 160 characters." },
        { status: 400 },
      );
    }

    const startDate = validDate(body.startDate);
    const targetDate = body.targetDate === undefined || body.targetDate === null || body.targetDate === ""
      ? null
      : validDate(body.targetDate);

    if (!startDate || (body.targetDate && !targetDate)) {
      return NextResponse.json({ error: "Enter valid start and target dates." }, { status: 400 });
    }
    if (targetDate && targetDate < startDate) {
      return NextResponse.json({ error: "Target date cannot precede the start date." }, { status: 400 });
    }

    const description = optionalText(body.description, 4000, "Description");
    if ("error" in description) return NextResponse.json({ error: description.error }, { status: 400 });
    const notes = optionalText(body.notes, 4000, "Notes");
    if ("error" in notes) return NextResponse.json({ error: notes.error }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.staffProfile.findFirst({
        where: {
          id: body.staffProfileId as string,
          schoolId,
          status: "ACTIVE",
        },
        select: { id: true, employeeNumber: true },
      });

      if (!employee) {
        return { error: "An active employee in this school must be selected.", status: 404 as const };
      }

      const plan = await tx.staffDevelopmentPlan.create({
        data: {
          schoolId,
          staffProfileId: employee.id,
          title: (body.title as string).trim(),
          description: description.value,
          startDate,
          targetDate,
          notes: notes.value,
          createdById: authorization.userId,
        },
        include: {
          staffProfile: { select: employeeSelect },
          goals: true,
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_DEVELOPMENT_PLAN_CREATED",
        resourceType: "StaffDevelopmentPlan",
        resourceId: plan.id,
        metadata: {
          staffProfileId: employee.id,
          employeeNumber: employee.employeeNumber,
          title: plan.title,
        },
      }, request);

      return { plan };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ plan: result.plan }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
