import { NextRequest, NextResponse } from "next/server";
import { SchoolMembershipRole, StaffOffboardingStatus } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = { params: Promise<{ schoolId: string }> };

const MANAGERS = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const DAY = 86_400_000;

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function monthLabels(from: Date, to: Date) {
  const result: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const last = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor <= last) {
    result.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

function counts<T extends string>(values: T[]) {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function inRange(date: Date | null, from: Date, toExclusive: Date) {
  return date !== null && date >= from && date < toExclusive;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...MANAGERS]);

    const params = request.nextUrl.searchParams;
    const today = new Date();
    const defaultTo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const defaultFrom = new Date(Date.UTC(defaultTo.getUTCFullYear(), defaultTo.getUTCMonth() - 11, 1));
    const from = params.has("from") ? parseDate(params.get("from")) : defaultFrom;
    const to = params.has("to") ? parseDate(params.get("to")) : defaultTo;
    const department = params.get("department")?.trim() || null;

    if (!from || !to || from > to || to.getTime() - from.getTime() > 5 * 366 * DAY) {
      return NextResponse.json(
        { error: "Provide a valid date range of no more than five years." },
        { status: 400 },
      );
    }
    if (department && department.length > 120) {
      return NextResponse.json({ error: "Department filter is too long." }, { status: 400 });
    }

    const toExclusive = new Date(to.getTime() + DAY);
    const months = monthLabels(from, to);
    const staffWhere = {
      schoolId,
      ...(department ? { department } : {}),
    };
    const staffRelationWhere = {
      schoolId,
      ...(department ? { staffProfile: { department } } : {}),
    };

    const [
      staff,
      attendance,
      leaveRequests,
      openings,
      applications,
      training,
      developmentPlans,
      developmentGoals,
      performanceGoals,
      reviews,
      cycles,
      offboardings,
      completedExits,
      offboardingTasks,
    ] = await Promise.all([
      prisma.staffProfile.findMany({
        where: staffWhere,
        select: {
          status: true,
          department: true,
          hireDate: true,
          employment: { select: { startDate: true } },
        },
      }),
      prisma.staffAttendance.findMany({
        where: {
          date: { gte: from, lt: toExclusive },
          staffProfile: staffWhere,
        },
        select: { date: true, status: true, minutesLate: true },
      }),
      prisma.staffLeaveRequest.findMany({
        where: { schoolId, createdAt: { gte: from, lt: toExclusive }, ...(department ? { staffProfile: { department } } : {}) },
        select: { leaveType: true, status: true, createdAt: true },
      }),
      prisma.jobOpening.findMany({
        where: { schoolId, createdAt: { gte: from, lt: toExclusive }, ...(department ? { department } : {}) },
        select: { status: true, department: true },
      }),
      prisma.jobApplication.findMany({
        where: {
          schoolId,
          appliedAt: { gte: from, lt: toExclusive },
          ...(department ? { jobOpening: { department } } : {}),
        },
        select: { stage: true, appliedAt: true },
      }),
      prisma.staffTrainingRecord.findMany({
        where: { schoolId, startDate: { gte: from, lt: toExclusive }, ...(department ? { staffProfile: { department } } : {}) },
        select: { status: true, startDate: true, completionDate: true },
      }),
      prisma.staffDevelopmentPlan.findMany({
        where: { schoolId, createdAt: { gte: from, lt: toExclusive }, ...(department ? { staffProfile: { department } } : {}) },
        select: { status: true },
      }),
      prisma.staffDevelopmentGoal.findMany({
        where: { schoolId, createdAt: { gte: from, lt: toExclusive }, ...(department ? { staffProfile: { department } } : {}) },
        select: { progress: true, completedAt: true },
      }),
      prisma.staffPerformanceGoal.findMany({
        where: { schoolId, createdAt: { gte: from, lt: toExclusive }, ...(department ? { staffProfile: { department } } : {}) },
        select: { status: true, progress: true },
      }),
      prisma.staffPerformanceReview.findMany({
        where: { schoolId, createdAt: { gte: from, lt: toExclusive }, ...(department ? { staffProfile: { department } } : {}) },
        select: { status: true, overallRating: true },
      }),
      prisma.performanceReviewCycle.findMany({
        where: { schoolId, startDate: { gte: from, lt: toExclusive } },
        select: { status: true },
      }),
      prisma.staffOffboarding.findMany({
        where: { schoolId, createdAt: { gte: from, lt: toExclusive }, ...(department ? { staffProfile: { department } } : {}) },
        select: { status: true, exitType: true },
      }),
      prisma.staffOffboarding.findMany({
        where: {
          schoolId,
          status: StaffOffboardingStatus.COMPLETED,
          effectiveTerminationDate: { gte: from, lt: toExclusive },
          ...(department ? { staffProfile: { department } } : {}),
        },
        select: { effectiveTerminationDate: true },
      }),
      prisma.staffOffboardingTask.findMany({
        where: { schoolId, createdAt: { gte: from, lt: toExclusive }, ...(department ? { staffProfile: { department } } : {}) },
        select: { required: true, status: true },
      }),
    ]);

    const workforceStatus = counts(staff.map((item) => item.status));
    const departmentCounts = counts(staff.map((item) => item.department?.trim() || "Unassigned"));
    const hiresByMonth = Object.fromEntries(months.map((month) => [month, 0]));
    let hires = 0;
    for (const item of staff) {
      const hireDate = item.hireDate ?? item.employment?.startDate ?? null;
      if (!inRange(hireDate, from, toExclusive)) continue;
      hires += 1;
      const key = monthKey(hireDate!);
      if (key in hiresByMonth) hiresByMonth[key] += 1;
    }

    const exitsByMonth = Object.fromEntries(months.map((month) => [month, 0]));
    for (const item of completedExits) {
      if (!item.effectiveTerminationDate) continue;
      const key = monthKey(item.effectiveTerminationDate);
      if (key in exitsByMonth) exitsByMonth[key] += 1;
    }

    const attendanceByDay = new Map<string, Record<string, number>>();
    for (const record of attendance) {
      const key = record.date.toISOString().slice(0, 10);
      const day = attendanceByDay.get(key) ?? {};
      day[record.status] = (day[record.status] ?? 0) + 1;
      attendanceByDay.set(key, day);
    }
    const attendanceStatuses = counts(attendance.map((item) => item.status));
    const lateRecords = attendance.filter((item) => item.status === "LATE");
    const lateMinutes = lateRecords.reduce((sum, item) => sum + (item.minutesLate ?? 0), 0);

    const leaveByMonth = Object.fromEntries(months.map((month) => [month, 0]));
    for (const item of leaveRequests) {
      const key = monthKey(item.createdAt);
      if (key in leaveByMonth) leaveByMonth[key] += 1;
    }

    const applicationsByMonth = Object.fromEntries(months.map((month) => [month, 0]));
    for (const item of applications) {
      const key = monthKey(item.appliedAt);
      if (key in applicationsByMonth) applicationsByMonth[key] += 1;
    }

    const completedTraining = training.filter((item) => item.status === "COMPLETED");
    const trainingCompletionsByMonth = Object.fromEntries(months.map((month) => [month, 0]));
    for (const item of completedTraining) {
      if (!item.completionDate) continue;
      const key = monthKey(item.completionDate);
      if (key in trainingCompletionsByMonth) trainingCompletionsByMonth[key] += 1;
    }

    const requiredTasks = offboardingTasks.filter((item) => item.required);
    const completedRequiredTasks = requiredTasks.filter((item) => item.status === "COMPLETED");
    const waivedTasks = offboardingTasks.filter((item) => item.status === "WAIVED");
    const ratingValues = reviews
      .map((item) => item.overallRating)
      .filter((rating): rating is number => rating !== null && Number.isInteger(rating) && rating >= 1 && rating <= 5);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      filters: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), department },
      months,
      workforce: {
        total: staff.length,
        byStatus: workforceStatus,
        byDepartment: Object.entries(departmentCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value),
      },
      movement: {
        hires,
        confirmedExits: completedExits.length,
        hiresByMonth,
        exitsByMonth,
      },
      attendance: {
        totalRecords: attendance.length,
        byStatus: attendanceStatuses,
        daily: [...attendanceByDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, values]) => ({ date, ...values })),
        lateCount: lateRecords.length,
        averageLateMinutes: lateRecords.length ? Number((lateMinutes / lateRecords.length).toFixed(1)) : null,
      },
      leave: {
        total: leaveRequests.length,
        byType: counts(leaveRequests.map((item) => item.leaveType)),
        byStatus: counts(leaveRequests.map((item) => item.status)),
        byMonth: leaveByMonth,
      },
      recruitment: {
        openings: openings.length,
        openingsByStatus: counts(openings.map((item) => item.status)),
        applications: applications.length,
        applicationsByStage: counts(applications.map((item) => item.stage)),
        applicationsByMonth,
      },
      learning: {
        trainingTotal: training.length,
        trainingByStatus: counts(training.map((item) => item.status)),
        completedTraining: completedTraining.length,
        trainingCompletionsByMonth,
        developmentPlans: developmentPlans.length,
        plansByStatus: counts(developmentPlans.map((item) => item.status)),
        developmentGoals: developmentGoals.length,
        averageDevelopmentProgress: developmentGoals.length
          ? Math.round(developmentGoals.reduce((sum, item) => sum + item.progress, 0) / developmentGoals.length)
          : null,
      },
      performance: {
        reviewCycles: cycles.length,
        cyclesByStatus: counts(cycles.map((item) => item.status)),
        reviews: reviews.length,
        reviewsByStatus: counts(reviews.map((item) => item.status)),
        averageRating: ratingValues.length
          ? Number((ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length).toFixed(2))
          : null,
        ratingDistribution: [1, 2, 3, 4, 5].map((rating) => ({
          rating,
          count: ratingValues.filter((value) => value === rating).length,
        })),
        goals: performanceGoals.length,
        goalsByStatus: counts(performanceGoals.map((item) => item.status)),
        averageGoalProgress: performanceGoals.length
          ? Math.round(performanceGoals.reduce((sum, item) => sum + item.progress, 0) / performanceGoals.length)
          : null,
      },
      offboarding: {
        records: offboardings.length,
        byStatus: counts(offboardings.map((item) => item.status)),
        byExitType: counts(offboardings.map((item) => item.exitType)),
        confirmedExits: completedExits.length,
        tasks: offboardingTasks.length,
        requiredTasks: requiredTasks.length,
        completedRequiredTasks: completedRequiredTasks.length,
        waivedTasks: waivedTasks.length,
        requiredTaskCompletionRate: requiredTasks.length
          ? Math.round((completedRequiredTasks.length / requiredTasks.length) * 100)
          : null,
      },
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("HR reports API error:", error);
    return NextResponse.json({ error: "Unable to load HR reports." }, { status: 500 });
  }
}
