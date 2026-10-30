import { NextRequest, NextResponse } from "next/server";
import {
  SchoolMembershipRole,
  StaffOffboardingStatus,
  StaffOffboardingTaskCategory,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ schoolId: string; recordId: string }>;
};

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const terminalStatuses: StaffOffboardingStatus[] = [
  StaffOffboardingStatus.REJECTED,
  StaffOffboardingStatus.WITHDRAWN,
  StaffOffboardingStatus.COMPLETED,
];

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    return undefined;
  }
  return value.trim() || null;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId, recordId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...roles]);

    const record = await prisma.staffOffboarding.findFirst({
      where: { id: recordId, schoolId },
      select: { id: true },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Offboarding record not found in this school." },
        { status: 404 },
      );
    }

    const tasks = await prisma.staffOffboardingTask.findMany({
      where: { schoolId, offboardingId: recordId },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      include: {
        documents: {
          select: {
            id: true,
            originalFileName: true,
            contentType: true,
            sizeBytes: true,
            uploadedById: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("[offboarding/tasks GET]", error);
    return authorizationErrorResponse(error) ??
      NextResponse.json({ error: "Unable to load offboarding tasks." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId, recordId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...roles],
    );

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const allowed = [
      "category", "title", "description", "required",
      "assignedToId", "dueDate", "evidenceRef",
    ];

    if (Object.keys(data).some((key) => !allowed.includes(key))) {
      return NextResponse.json(
        { error: "Request contains unsupported fields." },
        { status: 400 },
      );
    }

    if (
      typeof data.category !== "string" ||
      !Object.values(StaffOffboardingTaskCategory).includes(
        data.category as StaffOffboardingTaskCategory,
      ) ||
      typeof data.title !== "string" ||
      !data.title.trim() ||
      data.title.trim().length > 200
    ) {
      return NextResponse.json(
        { error: "A valid task category and title are required." },
        { status: 400 },
      );
    }

    const title = data.title.trim();
    const description = parseText(data.description, 4000);
    const evidenceRef = parseText(data.evidenceRef, 1000);
    const dueDate = parseDate(data.dueDate);
    const assignedToId = parseText(data.assignedToId, 200);
    const required = data.required === undefined ? true : data.required;

    if (
      description === undefined ||
      evidenceRef === undefined ||
      dueDate === undefined ||
      assignedToId === undefined ||
      typeof required !== "boolean"
    ) {
      return NextResponse.json(
        { error: "One or more task fields are invalid." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.staffOffboarding.findFirst({
        where: { id: recordId, schoolId },
        select: {
          id: true,
          staffProfileId: true,
          status: true,
        },
      });

      if (!record) {
        return {
          error: "Offboarding record not found in this school.",
          status: 404 as const,
        };
      }

      if (terminalStatuses.includes(record.status)) {
        return {
          error: "Tasks cannot be added to a closed offboarding record.",
          status: 409 as const,
        };
      }

      if (assignedToId) {
        const membership = await tx.schoolMembership.findFirst({
          where: {
            schoolId,
            userId: assignedToId,
            isActive: true,
          },
          select: { id: true },
        });

        if (!membership) {
          return {
            error: "The assigned user must have an active membership in this school.",
            status: 400 as const,
          };
        }
      }

      const task = await tx.staffOffboardingTask.create({
        data: {
          schoolId,
          staffProfileId: record.staffProfileId,
          offboardingId: record.id,
          category: data.category as StaffOffboardingTaskCategory,
          title,
          description,
          required,
          assignedToId,
          dueDate,
          evidenceRef,
          createdById: authorization.userId,
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_OFFBOARDING_TASK_CREATED",
        resourceType: "StaffOffboardingTask",
        resourceId: task.id,
        metadata: {
          offboardingId: record.id,
          staffProfileId: record.staffProfileId,
          category: task.category,
          required: task.required,
          assignedToId: task.assignedToId,
          dueDate: task.dueDate?.toISOString() ?? null,
        },
      }, request);

      return { task };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ task: result.task }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "A concurrent update conflicted with task creation. Refresh and try again." },
        { status: 409 },
      );
    }

    return authorizationErrorResponse(error) ??
      NextResponse.json({ error: "Unable to create offboarding task." }, { status: 500 });
  }
}
