import { NextRequest, NextResponse } from "next/server";
import {
  SchoolMembershipRole,
  StaffOffboardingStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const maxBytes = 10 * 1024 * 1024;

const closedStatuses: StaffOffboardingStatus[] = [
  StaffOffboardingStatus.REJECTED,
  StaffOffboardingStatus.WITHDRAWN,
  StaffOffboardingStatus.COMPLETED,
];

type Context = {
  params: Promise<{
    schoolId: string;
    recordId: string;
    taskId: string;
  }>;
};

function matchesFileSignature(type: string, bytes: Uint8Array) {
  if (type === "application/pdf") {
    return bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d;
  }

  if (type === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;
  }

  if (type === "image/jpeg") {
    return bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
  }

  return false;
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId, recordId, taskId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...roles],
    );

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maxBytes + 128 * 1024) {
      return NextResponse.json(
        { error: "The upload exceeds the 10 MiB file limit." },
        { status: 413 },
      );
    }

    const task = await prisma.staffOffboardingTask.findFirst({
      where: { id: taskId, schoolId, offboardingId: recordId },
      select: {
        id: true,
        offboarding: { select: { status: true } },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Clearance task not found in this school and case." },
        { status: 404 },
      );
    }

    if (closedStatuses.includes(task.offboarding.status)) {
      return NextResponse.json(
        { error: "Documents cannot be added to a closed offboarding case." },
        { status: 409 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Choose a non-empty document to upload." },
        { status: 400 },
      );
    }

    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: "The maximum document size is 10 MiB." },
        { status: 413 },
      );
    }

    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, JPEG, and PNG files are allowed." },
        { status: 415 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (!matchesFileSignature(file.type, bytes)) {
      return NextResponse.json(
        { error: "The file content does not match its declared file type." },
        { status: 415 },
      );
    }

    const originalFileName = file.name
      .replace(/[\r\n"\\/]/g, "_")
      .replace(/[^\x20-\x7E]/g, "_")
      .slice(0, 180) || "document";

    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.staffOffboardingTaskDocument.create({
        data: {
          schoolId,
          taskId,
          originalFileName,
          contentType: file.type,
          sizeBytes: bytes.byteLength,
          data: Buffer.from(bytes),
          uploadedById: authorization.userId,
        },
        select: {
          id: true,
          originalFileName: true,
          contentType: true,
          sizeBytes: true,
          uploadedById: true,
          createdAt: true,
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_OFFBOARDING_TASK_DOCUMENT_UPLOADED",
        resourceType: "StaffOffboardingTaskDocument",
        resourceId: document.id,
        metadata: {
          offboardingId: recordId,
          taskId,
          originalFileName,
          contentType: file.type,
          sizeBytes: bytes.byteLength,
        },
      }, request);

      return document;
    });

    return NextResponse.json({ document: result }, { status: 201 });
  } catch (error) {
    return authorizationErrorResponse(error) ??
      NextResponse.json(
        { error: "Unable to upload the clearance-task document." },
        { status: 500 },
      );
  }
}
