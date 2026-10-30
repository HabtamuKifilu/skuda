import { NextRequest } from "next/server";
import {
  SchoolMembershipRole,
  StaffAttendanceStatus,
  StaffStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = { params: Promise<{ schoolId: string }> };

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
];

const statuses = Object.values(StaffAttendanceStatus);

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, roles);

    const dateValue = request.nextUrl.searchParams.get("date");
    const date = parseDate(dateValue);
    if (!date) {
      return Response.json({ error: "Provide a valid date in YYYY-MM-DD format." }, { status: 400 });
    }
    const nextDate = new Date(date.getTime() + 86_400_000);


    const [employees, records] = await Promise.all([
      prisma.staffProfile.findMany({
        where: {
          schoolId,
          status: { in: [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE] },
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
          status: true,
        },
      }),
      prisma.staffAttendance.findMany({
        where: {
          date: { gte: date, lt: nextDate },
          staffProfile: { schoolId },
        },
        select: {
          id: true,
          staffProfileId: true,
          status: true,
          minutesLate: true,
          note: true,
        },
      }),
    ]);

    return Response.json({ employees, records, date: dateValue });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to load staff attendance:", error);
    return Response.json({ error: "Unable to load staff attendance." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(request.headers, schoolId, roles);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Provide an attendance date and records." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const date = parseDate(data.date);

    if (
      Object.keys(data).some((key) => !["date", "records"].includes(key)) ||
      !date ||
      !Array.isArray(data.records) ||
      data.records.length > 500
    ) {
      return Response.json({ error: "Provide a valid date and up to 500 attendance records." }, { status: 400 });
    }

    const seen = new Set<string>();
    const records: {
      staffProfileId: string;
      status: StaffAttendanceStatus;
      minutesLate: number | null;
      note: string | null;
    }[] = [];

    for (const item of data.records) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return Response.json({ error: "Each attendance record must be an object." }, { status: 400 });
      }

      const record = item as Record<string, unknown>;
      if (
        Object.keys(record).some((key) =>
          !["staffProfileId", "status", "minutesLate", "note"].includes(key),
        ) ||
        typeof record.staffProfileId !== "string" ||
        !record.staffProfileId.trim() ||
        seen.has(record.staffProfileId) ||
        typeof record.status !== "string" ||
        !statuses.includes(record.status as StaffAttendanceStatus)
      ) {
        return Response.json({ error: "An attendance record contains invalid or duplicate fields." }, { status: 400 });
      }

      if (
        record.minutesLate !== undefined &&
        record.minutesLate !== null &&
        (!Number.isInteger(record.minutesLate) ||
          (record.minutesLate as number) < 0 ||
          (record.minutesLate as number) > 1440)
      ) {
        return Response.json({ error: "Late minutes must be a whole number from 0 to 1440." }, { status: 400 });
      }

      if (
        record.note !== undefined &&
        record.note !== null &&
        (typeof record.note !== "string" || record.note.length > 1000)
      ) {
        return Response.json({ error: "Attendance notes cannot exceed 1,000 characters." }, { status: 400 });
      }

      seen.add(record.staffProfileId);

      records.push({
        staffProfileId: record.staffProfileId,
        status: record.status as StaffAttendanceStatus,
        minutesLate: record.status === "LATE"
          ? (typeof record.minutesLate === "number" ? record.minutesLate : 0)
          : null,
        note: typeof record.note === "string" ? record.note.trim() || null : null,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const employees = await tx.staffProfile.findMany({
        where: {
          schoolId,
          id: { in: records.map((record) => record.staffProfileId) },
          status: { in: [StaffStatus.ACTIVE, StaffStatus.ON_LEAVE] },
        },
        select: { id: true, employeeNumber: true },
      });

      if (employees.length !== records.length) {
        return {
          error: "One or more employees are unavailable in this school. Refresh and try again.",
          status: 400 as const,
        };
      }

      const saved = [];

      for (const record of records) {
        const existing = await tx.staffAttendance.findUnique({
          where: {
            staffProfileId_date: {
              staffProfileId: record.staffProfileId,
              date,
            },
          },
          select: {
            id: true,
            status: true,
            minutesLate: true,
            note: true,
          },
        });

        const updated = await tx.staffAttendance.upsert({
          where: {
            staffProfileId_date: {
              staffProfileId: record.staffProfileId,
              date,
            },
          },
          create: {
            staffProfileId: record.staffProfileId,
            date,
            status: record.status,
            minutesLate: record.minutesLate,
            note: record.note,
          },
          update: {
            status: record.status,
            minutesLate: record.minutesLate,
            note: record.note,
          },
        });

        if (
          !existing ||
          existing.status !== record.status ||
          existing.minutesLate !== record.minutesLate ||
          existing.note !== record.note
        ) {
          await createAuditLog(tx, {
            actorId: authorization.userId,
            schoolId,
            action: existing ? "STAFF_ATTENDANCE_UPDATED" : "STAFF_ATTENDANCE_RECORDED",
            resourceType: "StaffAttendance",
            resourceId: updated.id,
            metadata: {
              staffProfileId: record.staffProfileId,
              date: data.date as string,
              status: record.status,
              minutesLate: record.minutesLate,
            },
          }, request);
        }

        saved.push(updated);
      }

      return { records: saved };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ saved: result.records.length, records: result.records });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to save staff attendance:", error);
    return Response.json({ error: "Unable to save staff attendance." }, { status: 500 });
  }
}
