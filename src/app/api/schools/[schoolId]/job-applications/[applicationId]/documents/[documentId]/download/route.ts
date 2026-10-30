import { NextRequest } from "next/server";
import {
  ApplicationDocumentStatus,
  SchoolMembershipRole,
} from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const recruitmentRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
];

type RouteContext = {
  params: Promise<{
    schoolId: string;
    applicationId: string;
    documentId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, applicationId, documentId } = await context.params;
    const preview = request.nextUrl.searchParams.get("view") === "preview";

    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      recruitmentRoles,
    );

    const document = await prisma.jobApplicationDocument.findFirst({
      where: {
        id: documentId,
        schoolId,
        applicationId,
        status: ApplicationDocumentStatus.UPLOADED,
      },
      select: {
        id: true,
        documentType: true,
        originalFileName: true,
        contentType: true,
        sizeBytes: true,
        data: true,
      },
    });

    if (!document) {
      return Response.json(
        { error: "Application document not found." },
        { status: 404 },
      );
    }

    if (document.data === null) {
      return Response.json(
        { error: "This document has no file data in the database." },
        { status: 410 },
      );
    }

    if (document.data.byteLength !== document.sizeBytes) {
      console.error("Application document size mismatch:", document.id);
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

    await prisma.$transaction(async (tx) => {
      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: preview
            ? "JOB_APPLICATION_DOCUMENT_PREVIEWED"
            : "JOB_APPLICATION_DOCUMENT_DOWNLOADED",
          resourceType: "JobApplicationDocument",
          resourceId: document.id,
          metadata: {
            applicationId,
            documentType: document.documentType,
          },
        },
        request,
      );
    });

    const bytes = new Uint8Array(document.data.byteLength);
    bytes.set(document.data);

    const safeFileName =
      document.originalFileName
        .replace(/[\r\n"\\/]/g, "_")
        .replace(/[^\x20-\x7E]/g, "_")
        .slice(0, 180) || "document";

    return new Response(bytes.buffer, {
      headers: {
        "Content-Type": document.contentType,
        "Content-Length": String(document.sizeBytes),
        "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${safeFileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(preview ? { "Content-Security-Policy": "frame-ancestors 'self'" } : {}),
      },
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to serve application document:", error);
    return Response.json(
      { error: "Unable to access the application document." },
      { status: 500 },
    );
  }
}
