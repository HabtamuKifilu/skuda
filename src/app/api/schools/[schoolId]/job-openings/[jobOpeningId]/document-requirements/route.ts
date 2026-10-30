import { NextRequest } from "next/server";
import {
  ApplicationDocumentType,
  SchoolMembershipRole,
} from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const recruitmentRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
];

type RouteContext = {
  params: Promise<{ schoolId: string; jobOpeningId: string }>;
};

const validTypes = Object.values(ApplicationDocumentType);

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, jobOpeningId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, recruitmentRoles);

    const opening = await prisma.jobOpening.findFirst({
      where: { id: jobOpeningId, schoolId },
      select: { id: true },
    });

    if (!opening) {
      return Response.json({ error: "Vacancy not found." }, { status: 404 });
    }

    const requirements = await prisma.jobOpeningDocumentRequirement.findMany({
      where: { schoolId, jobOpeningId },
      orderBy: { documentType: "asc" },
      select: {
        id: true,
        documentType: true,
        label: true,
        isRequired: true,
      },
    });

    return Response.json({ requirements });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load document requirements:", error);
    return Response.json(
      { error: "Unable to load document requirements." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, jobOpeningId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      recruitmentRoles,
    );

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "A valid request body is required." }, { status: 400 });
    }

    const raw = (body as Record<string, unknown>).requirements;
    if (!Array.isArray(raw) || raw.length > validTypes.length) {
      return Response.json(
        { error: "Provide a valid list of document requirements." },
        { status: 400 },
      );
    }

    const requirements: {
      documentType: ApplicationDocumentType;
      label: string | null;
      isRequired: boolean;
    }[] = [];
    const seen = new Set<string>();

    for (const item of raw) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return Response.json({ error: "Each requirement must be an object." }, { status: 400 });
      }

      const value = item as Record<string, unknown>;
      const documentType = value.documentType;
      const label = value.label;
      const isRequired = value.isRequired;

      if (
        typeof documentType !== "string" ||
        !validTypes.includes(documentType as ApplicationDocumentType) ||
        seen.has(documentType)
      ) {
        return Response.json(
          { error: "Document types must be valid and unique." },
          { status: 400 },
        );
      }

      if (
        label !== undefined &&
        label !== null &&
        (typeof label !== "string" || label.trim().length > 100)
      ) {
        return Response.json(
          { error: "Document labels must be 100 characters or fewer." },
          { status: 400 },
        );
      }

      if (typeof isRequired !== "boolean") {
        return Response.json(
          { error: "Specify whether each document is required." },
          { status: 400 },
        );
      }

      seen.add(documentType);
      requirements.push({
        documentType: documentType as ApplicationDocumentType,
        label: typeof label === "string" ? label.trim() || null : null,
        isRequired,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const opening = await tx.jobOpening.findFirst({
        where: { id: jobOpeningId, schoolId },
        select: { id: true, title: true },
      });

      if (!opening) return { notFound: true as const };

      await tx.jobOpeningDocumentRequirement.deleteMany({
        where: { schoolId, jobOpeningId },
      });

      if (requirements.length) {
        await tx.jobOpeningDocumentRequirement.createMany({
          data: requirements.map((item) => ({
            schoolId,
            jobOpeningId,
            ...item,
          })),
        });
      }

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "JOB_DOCUMENT_REQUIREMENTS_UPDATED",
          resourceType: "JobOpening",
          resourceId: jobOpeningId,
          metadata: {
            title: opening.title,
            requirements: requirements.map((item) => ({
              documentType: item.documentType,
              isRequired: item.isRequired,
              label: item.label,
            })),
          },
        },
        request,
      );

      return { saved: true as const };
    });

    if ("notFound" in result) {
      return Response.json({ error: "Vacancy not found." }, { status: 404 });
    }

    return Response.json({ success: true, requirements });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to save document requirements:", error);
    return Response.json(
      { error: "Unable to save document requirements." },
      { status: 500 },
    );
  }
}
