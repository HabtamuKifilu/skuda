import { NextRequest, NextResponse } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import {
  requireSchoolMembership,
  requireSchoolRole,
} from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const MANAGERS = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const REVIEWER_ROLES = [
  ...MANAGERS,
  SchoolMembershipRole.ACADEMIC_HEAD,
] as const;

type Context = { params: Promise<{ schoolId: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 &&
    Number.isFinite(Date.parse(value));
}

function errorResponse(error: unknown): Response {
  const response = authorizationErrorResponse(error);
  if (response) return response;

  console.error("Performance management API error:", error);
  return Response.json(
    { error: "An unexpected error occurred." },
    { status: 500 },
  );
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolMembership(
      request.headers,
      schoolId,
    );
    const isManager = authorization.roles.some((role) =>
      MANAGERS.includes(role as (typeof MANAGERS)[number]),
    );

    const [cycles, employees, memberships] = await Promise.all([
      prisma.performanceReviewCycle.findMany({
        where: {
          schoolId,
          ...(isManager
            ? {}
            : { reviews: { some: { reviewerId: authorization.userId } } }),
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        include: {
          reviews: {
            ...(isManager
              ? {}
              : { where: { reviewerId: authorization.userId } }),
            orderBy: { createdAt: "asc" },
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
                  userId: true,
                },
              },
              reviewer: {
                select: { id: true, name: true, email: true },
              },
              competencies: {
                orderBy: { competency: "asc" },
              },
            },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      isManager ? prisma.staffProfile.findMany({
        where: { schoolId, status: "ACTIVE" },
        select: {
          id: true,
          userId: true,
          employeeNumber: true,
          firstName: true,
          middleName: true,
          lastName: true,
          jobTitle: true,
          department: true,
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }) : Promise.resolve([]),
      isManager ? prisma.schoolMembership.findMany({
        where: {
          schoolId,
          isActive: true,
          role: { in: [...REVIEWER_ROLES] },
        },
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }) : Promise.resolve([]),
    ]);

    const reviewerMap = new Map<
      string,
      { id: string; name: string; email: string; roles: string[] }
    >();

    for (const membership of memberships) {
      const current = reviewerMap.get(membership.user.id);
      if (current) {
        if (!current.roles.includes(membership.role)) {
          current.roles.push(membership.role);
        }
      } else {
        reviewerMap.set(membership.user.id, {
          ...membership.user,
          roles: [membership.role],
        });
      }
    }

    return NextResponse.json({
      cycles,
      employees,
      reviewers: [...reviewerMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      currentUserId: authorization.userId,
      isManager,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...MANAGERS],
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { name, description, startDate, endDate, assignments } = body;

    if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
      return NextResponse.json(
        { error: "Cycle name is required and must be at most 120 characters." },
        { status: 400 },
      );
    }

    if (
      description !== undefined &&
      description !== null &&
      (typeof description !== "string" || description.length > 4000)
    ) {
      return NextResponse.json(
        { error: "Description must be at most 4,000 characters." },
        { status: 400 },
      );
    }

    if (!validDate(startDate) || !validDate(endDate)) {
      return NextResponse.json(
        { error: "Valid start and end dates are required." },
        { status: 400 },
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return NextResponse.json(
        { error: "The end date must be on or after the start date." },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(assignments) ||
      assignments.length === 0 ||
      assignments.length > 500
    ) {
      return NextResponse.json(
        { error: "Assign between 1 and 500 employees to the review cycle." },
        { status: 400 },
      );
    }

    const normalizedAssignments: { staffProfileId: string; reviewerId: string }[] = [];
    const seenStaff = new Set<string>();

    for (const assignment of assignments) {
      if (
        !isRecord(assignment) ||
        typeof assignment.staffProfileId !== "string" ||
        !assignment.staffProfileId.trim() ||
        typeof assignment.reviewerId !== "string" ||
        !assignment.reviewerId.trim()
      ) {
        return NextResponse.json(
          { error: "Every assignment needs an employee and a reviewer." },
          { status: 400 },
        );
      }

      const staffProfileId = assignment.staffProfileId.trim();
      const reviewerId = assignment.reviewerId.trim();

      if (seenStaff.has(staffProfileId)) {
        return NextResponse.json(
          { error: "An employee can only be assigned once per review cycle." },
          { status: 400 },
        );
      }

      seenStaff.add(staffProfileId);
      normalizedAssignments.push({ staffProfileId, reviewerId });
    }

    const staffIds = normalizedAssignments.map((item) => item.staffProfileId);
    const reviewerIds = [...new Set(normalizedAssignments.map((item) => item.reviewerId))];

    const [employees, memberships] = await Promise.all([
      prisma.staffProfile.findMany({
        where: { schoolId, id: { in: staffIds }, status: "ACTIVE" },
        select: { id: true, userId: true },
      }),
      prisma.schoolMembership.findMany({
        where: {
          schoolId,
          userId: { in: reviewerIds },
          isActive: true,
          role: { in: [...REVIEWER_ROLES] },
        },
        select: { userId: true },
      }),
    ]);

    if (employees.length !== staffIds.length) {
      return NextResponse.json(
        { error: "One or more employees are inactive or do not belong to this school." },
        { status: 400 },
      );
    }

    const eligibleReviewerIds = new Set(memberships.map((item) => item.userId));
    if (reviewerIds.some((id) => !eligibleReviewerIds.has(id))) {
      return NextResponse.json(
        { error: "Every reviewer must have an active, eligible membership in this school." },
        { status: 400 },
      );
    }

    const employeeUserIds = new Map(
      employees.map((employee) => [employee.id, employee.userId]),
    );
    if (
      normalizedAssignments.some(
        (assignment) =>
          employeeUserIds.get(assignment.staffProfileId) != null &&
          employeeUserIds.get(assignment.staffProfileId) === assignment.reviewerId,
      )
    ) {
      return NextResponse.json(
        { error: "Employees cannot be assigned to review their own performance." },
        { status: 400 },
      );
    }

    const cycle = await prisma.$transaction(async (tx) => {
      const created = await tx.performanceReviewCycle.create({
        data: {
          schoolId,
          name: name.trim(),
          description:
            typeof description === "string" && description.trim()
              ? description.trim()
              : null,
          startDate: start,
          endDate: end,
          createdById: authorization.userId,
          reviews: {
            create: normalizedAssignments.map((assignment) => ({
              staffProfile: {
                connect: {
                  id_schoolId: {
                    id: assignment.staffProfileId,
                    schoolId,
                  },
                },
              },
              reviewer: {
                connect: { id: assignment.reviewerId },
              },
              school: {
                connect: { id: schoolId },
              },
            })),
          },
        },
        include: {
          reviews: {
            include: {
              staffProfile: {
                select: {
                  id: true,
                  employeeNumber: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  jobTitle: true,
                },
              },
              reviewer: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "PERFORMANCE_REVIEW_CYCLE_CREATED",
          resourceType: "PerformanceReviewCycle",
          resourceId: created.id,
          metadata: {
            name: created.name,
            assignmentCount: normalizedAssignments.length,
          },
        },
        request,
      );

      return created;
    });

    return NextResponse.json({ cycle }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
