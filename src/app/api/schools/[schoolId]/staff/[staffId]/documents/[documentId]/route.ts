import { NextRequest } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const roles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
];

type Context = {
  params: Promise<{ schoolId: string; staffId: string; documentId: string }>;
};

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { schoolId, staffId, documentId } = await context.params;
    const authorization = await requireSchoolRole(request.headers, schoolId, [...roles]);

    const document = await prisma.staffDocument.findFirst({
      where: { id: documentId, schoolId, staffProfileId: staffId },
      select: { id: true, title: true, documentType: true },
    });
    if (!document) {
      return Response.json({ error: "Employee document not found." }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const completedPlan = await tx.staffOnboarding.findFirst({
        where: { schoolId, staffProfileId: staffId, completedAt: { not: null } },
        select: { id: true },
      });
      if (completedPlan) return { blocked: true as const };

      const deleted = await tx.staffDocument.deleteMany({
        where: { id: document.id, schoolId, staffProfileId: staffId },
      });
      if (deleted.count !== 1) {
        throw new Error("STAFF_DOCUMENT_NOT_FOUND");
      }
      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: "STAFF_DOCUMENT_DELETED",
        resourceType: "StaffDocument",
        resourceId: document.id,
        metadata: {
          staffProfileId: staffId,
          title: document.title,
          documentType: document.documentType,
        },
      }, request);
      return { blocked: false as const };
    });

    if (result.blocked) {
      return Response.json(
        { error: "Documents cannot be deleted because this employee has a completed onboarding plan." },
        { status: 409 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "STAFF_DOCUMENT_NOT_FOUND") {
      return Response.json({ error: "Employee document not found." }, { status: 404 });
    }
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to delete staff document:", error);
    return Response.json({ error: "Unable to delete the employee document." }, { status: 500 });
  }
}
