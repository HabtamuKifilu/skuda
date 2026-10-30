import { randomUUID } from "node:crypto";
import {
  ApplicationDocumentStatus,
  ApplicationDocumentType,
  JobApplicationStage,
  JobOpeningStatus,
} from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolSlug: string }>;
};

const documentTypes = Object.values(ApplicationDocumentType);
const maxFileSize = 10 * 1024 * 1024;

type PreparedDocument = {
  documentType: ApplicationDocumentType;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  bytes: Uint8Array;
  storageKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function prepareFile(
  type: ApplicationDocumentType,
  file: File,
): PreparedDocument | string {
  if (file.size < 1 || file.size > maxFileSize) {
    return "Each document must be smaller than or equal to 10 MB and not empty.";
  }

  const originalName = file.name.split(/[\\/]/).pop()?.trim() || "";
  const extension = originalName.split(".").pop()?.toLowerCase() || "";

  const formats: Record<
    string,
    { contentType: string; signature: (bytes: Uint8Array) => boolean }
  > = {
    pdf: {
      contentType: "application/pdf",
      signature: (b) =>
        b.length >= 5 &&
        b[0] === 0x25 &&
        b[1] === 0x50 &&
        b[2] === 0x44 &&
        b[3] === 0x46 &&
        b[4] === 0x2d,
    },
    png: {
      contentType: "image/png",
      signature: (b) =>
        b.length >= 8 &&
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
          (byte, index) => b[index] === byte,
        ),
    },
    jpg: {
      contentType: "image/jpeg",
      signature: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    jpeg: {
      contentType: "image/jpeg",
      signature: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    doc: {
      contentType: "application/msword",
      signature: (b) =>
        b.length >= 8 &&
        [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
          (byte, index) => b[index] === byte,
        ),
    },
    docx: {
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      signature: (b) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b,
    },
  };

  const format = formats[extension];
  if (!format) {
    return "Documents must be PDF, DOC, DOCX, JPG, JPEG, or PNG files.";
  }

  const suppliedType = file.type.trim().toLowerCase();
  if (
    suppliedType &&
    suppliedType !== "application/octet-stream" &&
    suppliedType !== format.contentType
  ) {
    return "A document's file type does not match its extension.";
  }

  return {
    documentType: type,
    fileName: originalName.replace(/[\u0000-\u001f\u007f]/g, "_").slice(0, 180) || "document",
    contentType: format.contentType,
    sizeBytes: file.size,
    bytes: new Uint8Array(),
    storageKey: "",
  };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { schoolSlug } = await context.params;
    const isMultipart = request.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("multipart/form-data");

    let input: Record<string, unknown>;
    let formData: FormData | null = null;

    if (isMultipart) {
      formData = await request.formData();
      input = {
        jobOpeningId: formData.get("jobOpeningId"),
        candidateName: formData.get("candidateName"),
        email: formData.get("email"),
        phone: formData.get("phone"),
      };
    } else {
      const body: unknown = await request.json().catch(() => null);
      if (!isRecord(body)) {
        return Response.json(
          { error: "A valid application is required." },
          { status: 400 },
        );
      }
      input = body;
    }

    const jobOpeningId =
      typeof input.jobOpeningId === "string" ? input.jobOpeningId.trim() : "";
    const candidateName =
      typeof input.candidateName === "string" ? input.candidateName.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim() : "";
    const phone = typeof input.phone === "string" ? input.phone.trim() : "";

    if (!jobOpeningId) {
      return Response.json({ error: "Select a vacancy." }, { status: 400 });
    }
    if (!candidateName || candidateName.length > 200) {
      return Response.json(
        { error: "Enter your name (maximum 200 characters)." },
        { status: 400 },
      );
    }
    if (
      email.length > 254 ||
      (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (phone.length > 40) {
      return Response.json(
        { error: "Phone must be 40 characters or fewer." },
        { status: 400 },
      );
    }
    if (!email && !phone) {
      return Response.json(
        { error: "Provide an email address or phone number." },
        { status: 400 },
      );
    }

    const school = await prisma.school.findFirst({
      where: { slug: schoolSlug, isActive: true },
      select: { id: true },
    });

    if (!school) {
      return Response.json({ error: "Careers page not found." }, { status: 404 });
    }

    const now = new Date();
    const opening = await prisma.jobOpening.findFirst({
      where: {
        id: jobOpeningId,
        schoolId: school.id,
        status: JobOpeningStatus.OPEN,
        isPublished: true,
        AND: [
          { OR: [{ openingDate: null }, { openingDate: { lte: now } }] },
          { OR: [{ closingDate: null }, { closingDate: { gte: now } }] },
        ],
      },
      select: {
        id: true,
        documentRequirements: {
          select: { documentType: true, label: true, isRequired: true },
        },
      },
    });

    if (!opening) {
      return Response.json(
        { error: "This vacancy is no longer accepting applications." },
        { status: 400 },
      );
    }

    const documents: PreparedDocument[] = [];

    if (formData) {
      for (const type of documentTypes) {
        const value = formData.get(`document_${type}`);
        if (value === null) continue;

        if (typeof value === "string" || !(value instanceof File)) {
          return Response.json(
            { error: `Invalid upload for ${type}.` },
            { status: 400 },
          );
        }

        const prepared = prepareFile(type, value);
        if (typeof prepared === "string") {
          return Response.json(
            { error: `${type}: ${prepared}` },
            { status: 400 },
          );
        }

        prepared.bytes = new Uint8Array(await value.arrayBuffer());
        if (!formatsSignatureMatches(prepared)) {
          return Response.json(
            { error: `${type}: The file content does not match its extension.` },
            { status: 400 },
          );
        }
        documents.push(prepared);
      }
    }

    const uploadedTypes = new Set(documents.map((document) => document.documentType));
    const missing = opening.documentRequirements
      .filter((requirement) => requirement.isRequired && !uploadedTypes.has(requirement.documentType))
      .map((requirement) => requirement.label || requirement.documentType);

    if (missing.length) {
      return Response.json(
        { error: `Upload all required documents: ${missing.join(", ")}.` },
        { status: 400 },
      );
    }

    const totalBytes = documents.reduce((sum, document) => sum + document.sizeBytes, 0);
    if (totalBytes > 25 * 1024 * 1024) {
      return Response.json(
        { error: "The combined upload size must not exceed 25 MB." },
        { status: 400 },
      );
    }

    const application = await prisma.jobApplication.create({
      data: {
        schoolId: school.id,
        jobOpeningId: opening.id,
        candidateName,
        email: email || null,
        phone: phone || null,
        stage: JobApplicationStage.RECEIVED,
      },
      select: { id: true },
    });

    try {
      await prisma.$transaction(async (tx) => {
        if (documents.length) {
          await tx.jobApplicationDocument.createMany({
            data: documents.map((document) => ({
              schoolId: school.id,
              applicationId: application.id,
              documentType: document.documentType,
              originalFileName: document.fileName,
              storageKey: `job-applications/${school.id}/${application.id}/${randomUUID()}`,
              data: Buffer.from(document.bytes),
              contentType: document.contentType,
              sizeBytes: document.sizeBytes,
              status: ApplicationDocumentStatus.UPLOADED,
            })),
          });
        }

        await createAuditLog(
          tx,
          {
            actorId: null,
            schoolId: school.id,
            action: "PUBLIC_JOB_APPLICATION_SUBMITTED",
            resourceType: "JobApplication",
            resourceId: application.id,
            metadata: {
              jobOpeningId: opening.id,
              documentTypes: documents.map((document) => document.documentType),
            },
          },
          request,
        );
      }, { maxWait: 120_000, timeout: 600_000 });
    } catch (error) {
      await prisma.jobApplication.deleteMany({
        where: { id: application.id, schoolId: school.id },
      });
      throw error;
    }

    return Response.json(
      { message: "Your application has been submitted successfully." },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to submit public job application:", error);
    return Response.json(
      { error: "Unable to submit your application. Please try again." },
      { status: 500 },
    );
  }
}

function formatsSignatureMatches(document: PreparedDocument): boolean {
  const bytes = document.bytes;
  const extension = document.fileName.split(".").pop()?.toLowerCase() || "";

  if (extension === "pdf") {
    return bytes.length >= 5 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 &&
      bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  }
  if (extension === "png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((byte, index) => bytes[index] === byte);
  }
  if (extension === "jpg" || extension === "jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff &&
      bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === "doc") {
    return [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
      .every((byte, index) => bytes[index] === byte);
  }
  if (extension === "docx") {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  }
  return false;
}
