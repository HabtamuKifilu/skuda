import { NextRequest } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

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

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

type Context = {
  params: Promise<{
    schoolId: string;
    recordId: string;
    taskId: string;
    documentId: string;
  }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId, recordId, taskId, documentId } = await context.params;
    const preview = request.nextUrl.searchParams.get("view") === "preview";
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...roles],
    );

    const document = await prisma.staffOffboardingTaskDocument.findFirst({
      where: {
        id: documentId,
        schoolId,
        taskId,
        task: { offboardingId: recordId, schoolId },
      },
      select: {
        id: true,
        originalFileName: true,
        contentType: true,
        sizeBytes: true,
        data: true,
      },
    });

    if (!document) {
      return Response.json(
        { error: "Clearance-task document not found." },
        { status: 404 },
      );
    }

    if (document.data.byteLength !== document.sizeBytes) {
      console.error("Offboarding task document size mismatch:", document.id);
      return Response.json(
        { error: "The stored document failed an integrity check." },
        { status: 500 },
      );
    }

    if (!matchesFileSignature(document.contentType, document.data)) {
      console.error("Offboarding task document signature mismatch:", document.id);
      return Response.json(
        { error: "The stored document failed an integrity check." },
        { status: 500 },
      );
    }

    if (preview && document.contentType !== "application/pdf") {
      return Response.json(
        { error: "Only PDF documents can be previewed." },
        { status: 415 },
      );
    }

    await createAuditLog(prisma, {
      actorId: authorization.userId,
      schoolId,
      action: preview
        ? "STAFF_OFFBOARDING_TASK_DOCUMENT_PREVIEWED"
        : "STAFF_OFFBOARDING_TASK_DOCUMENT_DOWNLOADED",
      resourceType: "StaffOffboardingTaskDocument",
      resourceId: document.id,
      metadata: {
        offboardingId: recordId,
        taskId,
        originalFileName: document.originalFileName,
      },
    }, request);

    const bytes = new Uint8Array(document.data.byteLength);
    bytes.set(document.data);

    const safeName = document.originalFileName
      .replace(/[\r\n"\\/]/g, "_")
      .replace(/[^\x20-\x7E]/g, "_")
      .slice(0, 180) || "document";

    return new Response(bytes.buffer, {
      headers: {
        "Content-Type": document.contentType,
        "Content-Length": String(document.sizeBytes),
        "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(preview
          ? { "Content-Security-Policy": "frame-ancestors 'self'" }
          : {}),
      },
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to serve offboarding task document:", error);
    return Response.json(
      { error: "Unable to access the clearance-task document." },
      { status: 500 },
    );
  }
}
