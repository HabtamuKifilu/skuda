import { NextRequest } from "next/server";
import {
  SchoolMembershipRole,
  StaffDocumentType,
} from "@/generated/prisma/client";
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

const maxBytes = 10 * 1024 * 1024;

type Context = {
  params: Promise<{ schoolId: string; staffId: string }>;
};

const documentSelect = {
  id: true,
  documentType: true,
  title: true,
  originalFileName: true,
  contentType: true,
  sizeBytes: true,
  issueDate: true,
  expiryDate: true,
  notes: true,
  uploadedById: true,
  reviewStatus: true,
  reviewedById: true,
  reviewedAt: true,
  reviewNotes: true,
  createdAt: true,
  updatedAt: true,
} as const;

function parseDate(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Dates must use YYYY-MM-DD format.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Please provide a valid calendar date.");
  }
  return date;
}

function matchesFileSignature(type: string, bytes: Uint8Array) {
  if (type === "application/pdf") {
    return bytes.length >= 5 &&
      String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
  }
  if (type === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 &&
      bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a &&
      bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (type === "image/jpeg") {
    return bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return false;
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId, staffId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...roles]);

    const staff = await prisma.staffProfile.findFirst({
      where: { id: staffId, schoolId },
      select: { id: true },
    });
    if (!staff) {
      return Response.json({ error: "Employee not found in this school." }, { status: 404 });
    }

    const documents = await prisma.staffDocument.findMany({
      where: { schoolId, staffProfileId: staffId },
      select: documentSelect,
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ documents });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to list staff documents:", error);
    return Response.json({ error: "Unable to load employee documents." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId, staffId } = await context.params;
    const authorization = await requireSchoolRole(request.headers, schoolId, [...roles]);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > maxBytes + 128 * 1024) {
      return Response.json({ error: "The upload must not exceed 10 MiB." }, { status: 413 });
    }

    const staff = await prisma.staffProfile.findFirst({
      where: { id: staffId, schoolId },
      select: { id: true },
    });
    if (!staff) {
      return Response.json({ error: "Employee not found in this school." }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const rawType = form.get("documentType");
    const rawTitle = form.get("title");
    const rawNotes = form.get("notes");

    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Choose a document to upload." }, { status: 400 });
    }
    if (file.size > maxBytes) {
      return Response.json({ error: "The upload must not exceed 10 MiB." }, { status: 413 });
    }
    if (
      typeof rawType !== "string" ||
      !Object.values(StaffDocumentType).includes(rawType as StaffDocumentType)
    ) {
      return Response.json({ error: "Choose a valid document category." }, { status: 400 });
    }
    if (typeof rawTitle !== "string" || !rawTitle.trim() || rawTitle.trim().length > 160) {
      return Response.json({ error: "Title is required and must be at most 160 characters." }, { status: 400 });
    }
    if (typeof rawNotes === "string" && rawNotes.length > 2000) {
      return Response.json({ error: "Notes must not exceed 2,000 characters." }, { status: 400 });
    }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: "Only PDF, JPEG, and PNG files are supported." }, { status: 415 });
    }

    let issueDate: Date | null;
    let expiryDate: Date | null;
    try {
      issueDate = parseDate(form.get("issueDate"));
      expiryDate = parseDate(form.get("expiryDate"));
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Invalid date." }, { status: 400 });
    }
    if (issueDate && expiryDate && expiryDate < issueDate) {
      return Response.json({ error: "Expiry date cannot be earlier than issue date." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesFileSignature(file.type, bytes)) {
      return Response.json({ error: "The file contents do not match its declared type." }, { status: 415 });
    }

    const originalFileName =
      file.name.replace(/[\r\n"\\/]/g, "_").replace(/[^\x20-\x7E]/g, "_").slice(0, 180) ||
      "document";

    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.staffDocument.create({
        data: {
          schoolId,
          staffProfileId: staffId,
          documentType: rawType as StaffDocumentType,
          title: rawTitle.trim(),
          originalFileName,
          contentType: file.type,
          sizeBytes: bytes.byteLength,
          data: Buffer.from(bytes),
          issueDate,
          expiryDate,
          notes: typeof rawNotes === "string" ? rawNotes.trim() || null : null,
          uploadedById: authorization.userId,
        },
        select: documentSelect,
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_DOCUMENT_UPLOADED",
        resourceType: "StaffDocument",
        resourceId: created.id,
        metadata: {
          staffProfileId: staffId,
          documentType: created.documentType,
          title: created.title,
          sizeBytes: created.sizeBytes,
          contentType: created.contentType,
        },
      }, request);

      return created;
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to upload staff document:", error);
    return Response.json({ error: "Unable to upload the employee document." }, { status: 500 });
  }
}
