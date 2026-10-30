import { NextRequest } from "next/server";
import {
  ApplicationDocumentStatus,
  JobApplicationStage,
  JobOpeningStatus,
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
  params: Promise<{ schoolId: string }>;
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
} as const;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, recruitmentRoles);

    const params = request.nextUrl.searchParams;
    const query = params.get("q")?.trim();
    const jobOpeningId = params.get("jobOpeningId")?.trim();
    const stage = params.get("stage");

    if (
      stage &&
      !Object.values(JobApplicationStage).includes(
        stage as JobApplicationStage,
      )
    ) {
      return Response.json({ error: "Invalid application stage." }, { status: 400 });
    }

    const applications = await prisma.jobApplication.findMany({
      where: {
        schoolId,
        ...(jobOpeningId ? { jobOpeningId } : {}),
        ...(stage ? { stage: stage as JobApplicationStage } : {}),
        ...(query
          ? {
              OR: [
                { candidateName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
                {
                  jobOpening: {
                    title: { contains: query, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ appliedAt: "desc" }, { candidateName: "asc" }],
      select: selectApplication,
    });

    return Response.json({ applications });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load job applications:", error);
    return Response.json(
      { error: "Unable to load job applications." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
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
        { error: "Candidate name is required and must be 200 characters or fewer." },
        { status: 400 },
      );
    }

    if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return Response.json({ error: "Provide a valid email address." }, { status: 400 });
    }

    if (phone.length > 40) {
      return Response.json({ error: "Phone must be 40 characters or fewer." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const opening = await tx.jobOpening.findFirst({
        where: {
          id: jobOpeningId,
          schoolId,
          status: JobOpeningStatus.OPEN,
        },
        select: { id: true, title: true },
      });

      if (!opening) return { unavailable: true as const };

      const application = await tx.jobApplication.create({
        data: {
          schoolId,
          jobOpeningId,
          candidateName,
          email: email || null,
          phone: phone || null,
          stage: JobApplicationStage.RECEIVED,
        },
        select: selectApplication,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "JOB_APPLICATION_CREATED",
          resourceType: "JobApplication",
          resourceId: application.id,
          metadata: {
            jobOpeningId,
            jobTitle: opening.title,
            candidateName,
          },
        },
        request,
      );

      return { application };
    });

    if ("unavailable" in result) {
      return Response.json(
        { error: "The selected vacancy does not exist or is not open." },
        { status: 400 },
      );
    }

    return Response.json({ application: result.application }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to create job application:", error);
    return Response.json(
      { error: "Unable to record the application." },
      { status: 500 },
    );
  }
}
