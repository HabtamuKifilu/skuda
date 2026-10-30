import { NextRequest } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
];

type Context = {
  params: Promise<{ schoolId: string; staffId: string; documentId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId, staffId, documentId } = await context.params;
    const preview = request.nextUrl.searchParams.get("view") === "preview";
    const authorization = await requireSchoolRole(request.headers, schoolId, [...roles]);

    const document = await prisma.staffDocument.findFirst({
      where: { id: documentId, schoolId, staffProfileId: staffId },
      select: {
        id: true,
        title: true,
        documentType: true,
        originalFileName: true,
        contentType: true,
        sizeBytes: true,
        data: true,
      },
    });

    if (!document) {
      return Response.json({ error: "Employee document not found." }, { status: 404 });
    }
    if (document.data.byteLength !== document.sizeBytes) {
      console.error("Staff document size mismatch:", document.id);
      return Response.json({ error: "The stored document failed an integrity check." }, { status: 500 });
    }
    if (preview && document.contentType !== "application/pdf") {
      return Response.json({ error: "Only PDF documents can be previewed." }, { status: 415 });
    }

    await createAuditLog(prisma, {
      actorId: authorization.userId,
      schoolId,
      action: preview ? "STAFF_DOCUMENT_PREVIEWED" : "STAFF_DOCUMENT_DOWNLOADED",
      resourceType: "StaffDocument",
      resourceId: document.id,
      metadata: {
        staffProfileId: staffId,
        documentType: document.documentType,
        title: document.title,
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
        ...(preview ? { "Content-Security-Policy": "frame-ancestors 'self'" } : {}),
      },
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to serve staff document:", error);
    return Response.json({ error: "Unable to access the employee document." }, { status: 500 });
  }
}
