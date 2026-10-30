import { NextRequest } from "next/server";
import {
  EmploymentType,
  SchoolMembershipRole,
  StaffAccountAccessRequestStatus,
  StaffOnboardingRequirementType,
  StaffProbationReviewOutcome,
} from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string; onboardingId: string }>;
};

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const requestableRoles = [
  SchoolMembershipRole.ACADEMIC_HEAD,
  SchoolMembershipRole.ACCOUNTANT,
  SchoolMembershipRole.TEACHER,
  SchoolMembershipRole.REGISTRAR,
  SchoolMembershipRole.HR_MANAGER,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseDate(value: unknown, label: string): Date | string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${label} must use YYYY-MM-DD format.`;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return `${label} must be a valid calendar date.`;
  }

  return date;
}

function parseNotes(value: unknown, label: string, maxLength = 2000): string | null | string[] {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return [`${label} must be text or null.`];

  const normalized = value.trim();
  if (normalized.length > maxLength) return [`${label} must not exceed ${maxLength} characters.`];
  return normalized || null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, onboardingId } = await context.params;
    await requireSchoolRole(request.headers, schoolId, [...managementRoles]);

    const onboarding = await prisma.staffOnboarding.findFirst({
      where: { id: onboardingId, schoolId },
      include: {
        staffProfile: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            email: true,
            jobTitle: true,
            department: true,
            status: true,
            employment: {
              select: {
                employmentType: true,
                startDate: true,
                contractStartDate: true,
                contractEndDate: true,
              },
            },
          },
        },
        tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        acknowledgements: {
          include: {
            requirement: {
              select: {
                id: true,
                code: true,
                type: true,
                title: true,
                version: true,
                required: true,
                isActive: true,
              },
            },
          },
          orderBy: { acknowledgedAt: "desc" },
        },
        probationReviews: { orderBy: { reviewDueDate: "asc" } },
        accountAccessRequests: {
          include: {
            requestedBy: { select: { id: true, name: true, email: true } },
            reviewedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!onboarding) {
      return Response.json({ error: "Onboarding plan not found in this school." }, { status: 404 });
    }

    const [onboardingRequirements, documentRequirements, documents] = await Promise.all([
      prisma.staffOnboardingRequirement.findMany({
        where: { schoolId, isActive: true },
        orderBy: [{ type: "asc" }, { title: "asc" }],
      }),
      prisma.staffDocumentRequirement.findMany({
        where: { schoolId, isActive: true },
        orderBy: { title: "asc" },
      }),
      prisma.staffDocument.findMany({
        where: { schoolId, staffProfileId: onboarding.staffProfileId },
        select: {
          id: true,
          documentType: true,
          title: true,
          originalFileName: true,
          issueDate: true,
          expiryDate: true,
          reviewStatus: true,
          reviewedAt: true,
          reviewNotes: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return Response.json({
      onboarding,
      onboardingRequirements,
      documentRequirements,
      documents,
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load onboarding workflows:", error);
    return Response.json({ error: "Unable to load onboarding workflows." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, onboardingId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...managementRoles],
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!isRecord(body) || typeof body.action !== "string") {
      return Response.json({ error: "A valid workflow action is required." }, { status: 400 });
    }

    const onboarding = await prisma.staffOnboarding.findFirst({
      where: { id: onboardingId, schoolId },
      select: {
        id: true,
        schoolId: true,
        staffProfileId: true,
        completedAt: true,
        staffProfile: {
          select: {
            status: true,
            employment: { select: { employmentType: true } },
          },
        },
      },
    });

    if (!onboarding) {
      return Response.json({ error: "Onboarding plan not found in this school." }, { status: 404 });
    }

    if (onboarding.completedAt) {
      return Response.json({ error: "This onboarding plan is complete and cannot be changed." }, { status: 409 });
    }

    const notes = parseNotes(body.notes, "Notes");
    if (Array.isArray(notes)) return Response.json({ error: notes[0] }, { status: 400 });

    if (body.action === "acknowledge") {
      if (typeof body.requirementId !== "string" || !body.requirementId.trim()) {
        return Response.json({ error: "Select an onboarding requirement." }, { status: 400 });
      }

      const requirement = await prisma.staffOnboardingRequirement.findFirst({
        where: { id: body.requirementId, schoolId, isActive: true },
        select: { id: true, code: true, type: true, title: true, version: true },
      });

      if (!requirement) {
        return Response.json({ error: "Active onboarding requirement not found in this school." }, { status: 404 });
      }

      const existing = await prisma.staffOnboardingAcknowledgement.findUnique({
        where: {
          onboardingId_requirementId: {
            onboardingId,
            requirementId: requirement.id,
          },
        },
      });

      if (existing) {
        return Response.json({ acknowledgement: existing, alreadyAcknowledged: true });
      }

      const acknowledgement = await prisma.$transaction(async (tx) => {
        const created = await tx.staffOnboardingAcknowledgement.create({
          data: {
            schoolId,
            onboardingId,
            requirementId: requirement.id,
            acknowledgedById: authorization.userId,
            notes,
          },
        });

        await createAuditLog(tx, {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_ONBOARDING_REQUIREMENT_ACKNOWLEDGED",
          resourceType: "StaffOnboardingAcknowledgement",
          resourceId: created.id,
          metadata: {
            onboardingId,
            staffProfileId: onboarding.staffProfileId,
            requirementId: requirement.id,
            requirementCode: requirement.code,
            requirementType: requirement.type,
            requirementVersion: requirement.version,
          },
        }, request);

        return created;
      });

      return Response.json({ acknowledgement }, { status: 201 });
    }

    if (body.action === "schedule-probation-review") {
      if (onboarding.staffProfile.employment?.employmentType !== EmploymentType.PROBATION) {
        return Response.json({ error: "Set the employee's employment type to PROBATION before scheduling probation reviews." }, { status: 409 });
      }

      const startDate = parseDate(body.probationStartDate, "Probation start date");
      const endDate = parseDate(body.probationEndDate, "Probation end date");
      const dueDate = parseDate(body.reviewDueDate, "Review due date");

      if (typeof startDate === "string") return Response.json({ error: startDate }, { status: 400 });
      if (typeof endDate === "string") return Response.json({ error: endDate }, { status: 400 });
      if (typeof dueDate === "string") return Response.json({ error: dueDate }, { status: 400 });

      if (endDate < startDate || dueDate < startDate || dueDate > endDate) {
        return Response.json({ error: "The review due date must fall between the probation start and end dates." }, { status: 400 });
      }

      const review = await prisma.$transaction(async (tx) => {
        const created = await tx.staffProbationReview.create({
          data: {
            schoolId,
            onboardingId,
            staffProfileId: onboarding.staffProfileId,
            probationStartDate: startDate,
            probationEndDate: endDate,
            reviewDueDate: dueDate,
            notes,
          },
        });

        await createAuditLog(tx, {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_PROBATION_REVIEW_SCHEDULED",
          resourceType: "StaffProbationReview",
          resourceId: created.id,
          metadata: {
            onboardingId,
            staffProfileId: onboarding.staffProfileId,
            probationStartDate: startDate.toISOString(),
            probationEndDate: endDate.toISOString(),
            reviewDueDate: dueDate.toISOString(),
          },
        }, request);

        return created;
      });

      return Response.json({ review }, { status: 201 });
    }

    if (body.action === "submit-probation-review") {
      if (typeof body.reviewId !== "string" || !body.reviewId.trim()) {
        return Response.json({ error: "Select the probation review to update." }, { status: 400 });
      }

      if (
        typeof body.outcome !== "string" ||
        !Object.values(StaffProbationReviewOutcome).includes(body.outcome as StaffProbationReviewOutcome) ||
        body.outcome === StaffProbationReviewOutcome.PENDING
      ) {
        return Response.json({ error: "Choose PASSED, EXTENDED, or FAILED as the review outcome." }, { status: 400 });
      }

      const outcome = body.outcome as StaffProbationReviewOutcome;
      let nextReviewDate: Date | null = null;

      if (body.nextReviewDate !== undefined && body.nextReviewDate !== null && body.nextReviewDate !== "") {
        const parsed = parseDate(body.nextReviewDate, "Next review date");
        if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
        nextReviewDate = parsed;
      }

      if (outcome === StaffProbationReviewOutcome.EXTENDED && !nextReviewDate) {
        return Response.json({ error: "A next review date is required when probation is extended." }, { status: 400 });
      }

      const existing = await prisma.staffProbationReview.findFirst({
        where: { id: body.reviewId, schoolId, onboardingId },
      });

      if (!existing) {
        return Response.json({ error: "Probation review not found for this onboarding plan." }, { status: 404 });
      }

      if (existing.outcome !== StaffProbationReviewOutcome.PENDING) {
        return Response.json({ error: "This probation review has already been finalized." }, { status: 409 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const claimed = await tx.staffProbationReview.updateMany({
          where: {
            id: existing.id,
            schoolId,
            onboardingId,
            outcome: StaffProbationReviewOutcome.PENDING,
          },
          data: {
            outcome,
            reviewedAt: new Date(),
            reviewerId: authorization.userId,
            nextReviewDate,
            notes,
          },
        });

        if (claimed.count !== 1) {
          return { conflict: true as const };
        }

        const updated = await tx.staffProbationReview.findFirstOrThrow({
          where: { id: existing.id, schoolId, onboardingId },
        });

        await createAuditLog(tx, {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_PROBATION_REVIEW_FINALIZED",
          resourceType: "StaffProbationReview",
          resourceId: updated.id,
          metadata: {
            onboardingId,
            staffProfileId: onboarding.staffProfileId,
            previousOutcome: StaffProbationReviewOutcome.PENDING,
            outcome,
            nextReviewDate: nextReviewDate?.toISOString() ?? null,
          },
        }, request);

        return { conflict: false as const, review: updated };
      });

      if (result.conflict) {
        return Response.json(
          { error: "This probation review has already been finalized." },
          { status: 409 },
        );
      }

      return Response.json({ review: result.review });
    }

    if (body.action === "request-account-access") {
      if (
        typeof body.role !== "string" ||
        !requestableRoles.some((role) => role === body.role)
      ) {
        return Response.json({ error: "Choose a permitted staff role. Owner and admin roles must not be requested through onboarding." }, { status: 400 });
      }

      if (onboarding.staffProfile.status === "TERMINATED") {
        return Response.json({ error: "A terminated employee cannot be given school access." }, { status: 409 });
      }

      const role = body.role as (typeof requestableRoles)[number];
      const existing = await prisma.staffAccountAccessRequest.findFirst({
        where: {
          schoolId,
          onboardingId,
          requestedRole: role,
          status: StaffAccountAccessRequestStatus.PENDING,
        },
      });

      if (existing) {
        return Response.json({ error: "A pending access request already exists for this role.", accessRequest: existing }, { status: 409 });
      }

      const accessRequest = await prisma.$transaction(async (tx) => {
        const created = await tx.staffAccountAccessRequest.create({
          data: {
            schoolId,
            onboardingId,
            staffProfileId: onboarding.staffProfileId,
            requestedById: authorization.userId,
            requestedRole: role,
            requestNotes: notes,
          },
        });

        await tx.staffOnboarding.update({
          where: { id: onboardingId },
          data: { accountAccessRequired: true },
        });

        await createAuditLog(tx, {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_ACCOUNT_ACCESS_REQUESTED",
          resourceType: "StaffAccountAccessRequest",
          resourceId: created.id,
          metadata: {
            onboardingId,
            staffProfileId: onboarding.staffProfileId,
            requestedRole: role,
            status: created.status,
          },
        }, request);

        return created;
      });

      return Response.json({ accessRequest }, { status: 201 });
    }

    return Response.json({
      error: "Unsupported action. Use acknowledge, schedule-probation-review, submit-probation-review, or request-account-access.",
    }, { status: 400 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to update onboarding workflow:", error);
    return Response.json({ error: "Unable to update the onboarding workflow." }, { status: 500 });
  }
}
