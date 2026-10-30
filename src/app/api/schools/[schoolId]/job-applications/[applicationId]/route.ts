import { NextRequest } from "next/server";
import {
  ApplicationDocumentStatus,
  JobApplicationStage,
  Prisma,
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
  params: Promise<{ schoolId: string; applicationId: string }>;
};

const selectApplication = {
  id: true,
  jobOpeningId: true,
  candidateName: true,
  email: true,
  phone: true,
  stage: true,
  appliedAt: true,
  interviewNotes: true,
  decisionNotes: true,
  createdAt: true,
  updatedAt: true,
  documents: {
    where: { status: ApplicationDocumentStatus.UPLOADED },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      documentType: true,
      originalFileName: true,
      contentType: true,
      sizeBytes: true,
      status: true,
      createdAt: true,
    },
  },
  jobOpening: {
    select: {
      id: true,
      title: true,
      department: true,
      status: true,
    },
  },
} satisfies Prisma.JobApplicationSelect;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, applicationId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, recruitmentRoles);

    const application = await prisma.jobApplication.findFirst({
      where: { id: applicationId, schoolId },
      select: selectApplication,
    });

    if (!application) {
      return Response.json({ error: "Application not found." }, { status: 404 });
    }

    return Response.json({ application });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load job application:", error);
    return Response.json({ error: "Unable to load the application." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, applicationId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      recruitmentRoles,
    );

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "A valid request body is required." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const allowedFields = ["stage", "interviewNotes", "decisionNotes"];
    const unsupported = Object.keys(input).filter((key) => !allowedFields.includes(key));

    if (unsupported.length || Object.keys(input).length === 0) {
      return Response.json(
        { error: "Update only stage, interview notes, or decision notes." },
        { status: 400 },
      );
    }

    const update: Prisma.JobApplicationUpdateInput = {};

    if ("stage" in input) {
      if (
        typeof input.stage !== "string" ||
        !Object.values(JobApplicationStage).includes(input.stage as JobApplicationStage)
      ) {
        return Response.json({ error: "Select a valid application stage." }, { status: 400 });
      }
      update.stage = input.stage as JobApplicationStage;
    }

    for (const field of ["interviewNotes", "decisionNotes"] as const) {
      if (!(field in input)) continue;
      const value = input[field];

      if (value !== null && typeof value !== "string") {
        return Response.json({ error: `${field} must be text or null.` }, { status: 400 });
      }

      const normalized = typeof value === "string" ? value.trim() : "";
      if (normalized.length > 10000) {
        return Response.json({ error: `${field} must be 10,000 characters or fewer.` }, { status: 400 });
      }

      if (field === "interviewNotes") update.interviewNotes = normalized || null;
      if (field === "decisionNotes") update.decisionNotes = normalized || null;
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.jobApplication.findFirst({
        where: { id: applicationId, schoolId },
        select: {
          id: true,
          candidateName: true,
          stage: true,
          interviewNotes: true,
          decisionNotes: true,
        },
      });

      if (!existing) return { notFound: true as const };

      const updated = await tx.jobApplication.update({
        where: { id: existing.id },
        data: update,
        select: selectApplication,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "JOB_APPLICATION_UPDATED",
          resourceType: "JobApplication",
          resourceId: updated.id,
          metadata: {
            candidateName: existing.candidateName,
            previousStage: existing.stage,
            newStage: updated.stage,
            stageChanged: existing.stage !== updated.stage,
            interviewNotesChanged:
              "interviewNotes" in input &&
              existing.interviewNotes !== updated.interviewNotes,
            decisionNotesChanged:
              "decisionNotes" in input &&
              existing.decisionNotes !== updated.decisionNotes,
          },
        },
        request,
      );

      return { application: updated };
    });

    if ("notFound" in result) {
      return Response.json({ error: "Application not found in this school." }, { status: 404 });
    }

    return Response.json({ application: result.application });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to update job application:", error);
    return Response.json({ error: "Unable to update the application." }, { status: 500 });
  }
}
