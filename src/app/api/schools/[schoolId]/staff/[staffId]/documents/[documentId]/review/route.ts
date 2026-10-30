import { NextRequest } from "next/server";
import {
  SchoolMembershipRole,
  StaffDocumentReviewStatus,
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

type Context = {
  params: Promise<{
    schoolId: string;
    staffId: string;
    documentId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, staffId, documentId } = await context.params;
    const authorization = await requireSchoolRole(request.headers, schoolId, [...roles]);

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Provide a valid review decision." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((key) => !["status", "notes"].includes(key))) {
      return Response.json({ error: "Unexpected review fields." }, { status: 400 });
    }

    const status = input.status;
    if (
      status !== StaffDocumentReviewStatus.APPROVED &&
      status !== StaffDocumentReviewStatus.REJECTED
    ) {
      return Response.json({ error: "Choose approved or rejected." }, { status: 400 });
    }

    if (input.notes !== undefined && typeof input.notes !== "string") {
      return Response.json({ error: "Review notes must be text." }, { status: 400 });
    }

    const notes = typeof input.notes === "string" ? input.notes.trim() : "";
    if (notes.length > 2000) {
      return Response.json({ error: "Review notes must not exceed 2,000 characters." }, { status: 400 });
    }
    if (status === StaffDocumentReviewStatus.REJECTED && !notes) {
      return Response.json({ error: "Provide a reason when rejecting a document." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.staffDocument.findFirst({
        where: { id: documentId, schoolId, staffProfileId: staffId },
        select: { id: true, title: true, reviewStatus: true, documentType: true },
      });

      if (!document) return { missing: true as const };

      const completedPlan = await tx.staffOnboarding.findFirst({
        where: { schoolId, staffProfileId: staffId, completedAt: { not: null } },
        select: { id: true },
      });
      if (completedPlan) return { blocked: true as const };

      const reviewedAt = new Date();
      const updated = await tx.staffDocument.updateMany({
        where: {
          id: documentId,
          schoolId,
          staffProfileId: staffId,
          reviewStatus: document.reviewStatus,
        },
        data: {
          reviewStatus: status,
          reviewedById: authorization.userId,
          reviewedAt,
          reviewNotes: notes || null,
        },
      });

      if (updated.count !== 1) {
        return { missing: false as const, conflict: true as const };
      }

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: status === StaffDocumentReviewStatus.APPROVED
          ? "STAFF_DOCUMENT_APPROVED"
          : "STAFF_DOCUMENT_REJECTED",
        resourceType: "StaffDocument",
        resourceId: documentId,
        metadata: {
          staffProfileId: staffId,
          documentType: document.documentType,
          title: document.title,
          previousStatus: document.reviewStatus,
          reviewStatus: status,
          reviewNotes: notes || null,
        },
      }, request);

      return { missing: false as const, reviewStatus: status, reviewedAt, reviewNotes: notes || null };
    });

    if (result.missing) {
      return Response.json({ error: "Employee document not found." }, { status: 404 });
    }

    if ("blocked" in result && result.blocked) {
      return Response.json(
        { error: "Documents cannot be re-reviewed because this employee has a completed onboarding plan." },
        { status: 409 },
      );
    }

    if ("conflict" in result && result.conflict) {
      return Response.json(
        { error: "This document was reviewed by someone else. Refresh and try again." },
        { status: 409 },
      );
    }

    return Response.json({ document: { id: documentId, ...result } });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Provide valid JSON." }, { status: 400 });
    }
    console.error("Failed to review staff document:", error);
    return Response.json({ error: "Unable to review the employee document." }, { status: 500 });
  }
}
