import { NextRequest } from "next/server";
import {
  PerformanceReviewCycleStatus,
  SchoolMembershipRole,
  StaffPerformanceReviewStatus,
} from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolMembership } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";
import { createInAppNotification } from "@/lib/notifications";

type Context = {
  params: Promise<{ schoolId: string; reviewId: string }>;
};

const MANAGERS = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): { value: string | null } | { error: string } {
  if (value === undefined) return { value: null };
  if (value === null) return { value: null };
  if (typeof value !== "string" || value.trim().length > maxLength) {
    return { error: `${field} must be text of at most ${maxLength} characters.` };
  }
  return { value: value.trim() || null };
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, reviewId } = await context.params;
    const authorization = await requireSchoolMembership(request.headers, schoolId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!isRecord(body)) {
      return Response.json({ error: "A valid review update is required." }, { status: 400 });
    }

    const allowed = [
      "overallRating",
      "strengths",
      "improvementAreas",
      "reviewerComments",
      "competencies",
      "action",
    ];

    if (
      Object.keys(body).length === 0 ||
      Object.keys(body).some((key) => !allowed.includes(key))
    ) {
      return Response.json(
        { error: "The update is empty or contains unsupported fields." },
        { status: 400 },
      );
    }

    if (
      body.action !== undefined &&
      body.action !== "save" &&
      body.action !== "submit"
    ) {
      return Response.json({ error: "Choose save or submit." }, { status: 400 });
    }

    const textFields = [
      ["strengths", 4000],
      ["improvementAreas", 4000],
      ["reviewerComments", 4000],
    ] as const;

    const textValues: Record<string, string | null> = {};
    for (const [field, maxLength] of textFields) {
      if (body[field] === undefined) continue;
      const parsed = parseOptionalText(body[field], field, maxLength);
      if ("error" in parsed) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }
      textValues[field] = parsed.value;
    }

    let overallRating: number | null | undefined;
    if (body.overallRating !== undefined) {
      if (
        body.overallRating !== null &&
        (!Number.isInteger(body.overallRating) ||
          (body.overallRating as number) < 1 ||
          (body.overallRating as number) > 5)
      ) {
        return Response.json(
          { error: "Overall rating must be an integer from 1 to 5, or null." },
          { status: 400 },
        );
      }
      overallRating = body.overallRating as number | null;
    }

    let competencies:
      | {
          competency: string;
          rating: number;
          evidence: string | null;
          frameworkId?: string;
          frameworkCompetencyId?: string;
        }[]
      | undefined;

    if (body.competencies !== undefined) {
      if (!Array.isArray(body.competencies) || body.competencies.length > 50) {
        return Response.json(
          { error: "Competencies must be an array containing at most 50 entries." },
          { status: 400 },
        );
      }

      const names = new Set<string>();
      competencies = [];

      for (const item of body.competencies) {
        if (
          !isRecord(item) ||
          typeof item.competency !== "string" ||
          !item.competency.trim() ||
          item.competency.trim().length > 120 ||
          !Number.isInteger(item.rating) ||
          (item.rating as number) < 1 ||
          (item.rating as number) > 5
        ) {
          return Response.json(
            { error: "Each competency needs a name and an integer rating from 1 to 5." },
            { status: 400 },
          );
        }

        const competency = item.competency.trim();
        const normalizedName = competency.toLocaleLowerCase();
        if (names.has(normalizedName)) {
          return Response.json(
            { error: "Competency names must be unique within a review." },
            { status: 400 },
          );
        }
        names.add(normalizedName);

        const parsedEvidence = parseOptionalText(item.evidence, "Evidence", 2000);
        if ("error" in parsedEvidence) {
          return Response.json({ error: parsedEvidence.error }, { status: 400 });
        }

        const frameworkId = item.frameworkId;
        const frameworkCompetencyId = item.frameworkCompetencyId;
        if (
          (frameworkId !== undefined || frameworkCompetencyId !== undefined) &&
          (typeof frameworkId !== "string" ||
            !frameworkId ||
            typeof frameworkCompetencyId !== "string" ||
            !frameworkCompetencyId)
        ) {
          return Response.json(
            { error: "Framework-linked competencies require both framework and competency IDs." },
            { status: 400 },
          );
        }

        competencies.push({
          competency,
          rating: item.rating as number,
          evidence: parsedEvidence.value,
          ...(typeof frameworkId === "string" ? { frameworkId } : {}),
          ...(typeof frameworkCompetencyId === "string"
            ? { frameworkCompetencyId }
            : {}),
        });
      }
    }

    const isSubmitting = body.action === "submit";

    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.staffPerformanceReview.findFirst({
        where: { id: reviewId, schoolId },
        include: {
          cycle: { select: { id: true, name: true, status: true } },
          staffProfile: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true },
          },
          competencies: true,
        },
      });

      if (!review) {
        return { error: "Performance review not found in this school.", statusCode: 404 as const };
      }

      const isAssignedReviewer = review.reviewerId === authorization.userId;

      if (!isAssignedReviewer) {
        return {
          error: "Only the assigned reviewer may edit this review.",
          statusCode: 403 as const,
        };
      }

      if (review.status === StaffPerformanceReviewStatus.ACKNOWLEDGED) {
        return { error: "An acknowledged review cannot be changed.", statusCode: 409 as const };
      }

      if (review.status === StaffPerformanceReviewStatus.SUBMITTED) {
        return { error: "A submitted review cannot be edited.", statusCode: 409 as const };
      }

      if (review.cycle.status !== PerformanceReviewCycleStatus.OPEN) {
        return { error: "Reviews can only be edited while their cycle is open.", statusCode: 409 as const };
      }

      const persistedCompetencies =
        competencies === undefined
          ? undefined
          : await Promise.all(
              competencies.map(async (item) => {
                if (!item.frameworkId || !item.frameworkCompetencyId) {
                  return {
                    ...item,
                    frameworkId: null,
                    frameworkNameSnapshot: null,
                    frameworkCompetencyId: null,
                    descriptionSnapshot: null,
                    ratingCriteriaSnapshot: undefined,
                  };
                }

                const definition =
                  await tx.staffPerformanceCompetencyDefinition.findFirst({
                    where: {
                      id: item.frameworkCompetencyId,
                      schoolId,
                      frameworkId: item.frameworkId,
                      framework: { schoolId },
                    },
                    include: { framework: { select: { name: true } } },
                  });

                if (!definition) {
                  throw new Error("INVALID_FRAMEWORK_COMPETENCY");
                }

                return {
                  ...item,
                  competency: definition.name,
                  frameworkNameSnapshot: definition.framework.name,
                  descriptionSnapshot: definition.description,
                  ratingCriteriaSnapshot: {
                    rating1Criteria: definition.rating1Criteria,
                    rating2Criteria: definition.rating2Criteria,
                    rating3Criteria: definition.rating3Criteria,
                    rating4Criteria: definition.rating4Criteria,
                    rating5Criteria: definition.rating5Criteria,
                  },
                };
              }),
            );

      if (persistedCompetencies) {
        const persistedNames = persistedCompetencies.map((item) =>
          item.competency.toLocaleLowerCase(),
        );
        if (new Set(persistedNames).size !== persistedNames.length) {
          return {
            error: "Competency names must be unique within a review.",
            statusCode: 400 as const,
          };
        }
      }

      if (isSubmitting) {
        const finalRating =
          overallRating === undefined ? review.overallRating : overallRating;

        const finalStrengths =
          textValues.strengths === undefined ? review.strengths : textValues.strengths;
        const finalImprovements =
          textValues.improvementAreas === undefined
            ? review.improvementAreas
            : textValues.improvementAreas;
        const finalComments =
          textValues.reviewerComments === undefined
            ? review.reviewerComments
            : textValues.reviewerComments;

        const finalCompetencies = persistedCompetencies ?? review.competencies;

        if (
          finalRating === null ||
          !finalStrengths?.trim() ||
          !finalImprovements?.trim() ||
          !finalComments?.trim() ||
          finalCompetencies.length === 0
        ) {
          return {
            error: "Before submitting, provide an overall rating, strengths, improvement areas, reviewer comments, and at least one competency.",
            statusCode: 400 as const,
          };
        }
      }

      const updated = await tx.staffPerformanceReview.update({
        where: { id: review.id },
        data: {
          ...(overallRating !== undefined ? { overallRating } : {}),
          ...textValues,
          ...(isSubmitting
            ? {
                status: StaffPerformanceReviewStatus.SUBMITTED,
                submittedAt: new Date(),
              }
            : {
                status: StaffPerformanceReviewStatus.IN_PROGRESS,
              }),
          ...(persistedCompetencies !== undefined
            ? {
                competencies: {
                  deleteMany: {},
                  create: persistedCompetencies.map((item) => ({
                    schoolId,
                    competency: item.competency,
                    rating: item.rating,
                    evidence: item.evidence,
                    frameworkId: item.frameworkId ?? null,
                    frameworkNameSnapshot: item.frameworkNameSnapshot ?? null,
                    frameworkCompetencyId: item.frameworkCompetencyId ?? null,
                    descriptionSnapshot: item.descriptionSnapshot ?? null,
                    ...(item.ratingCriteriaSnapshot
                      ? { ratingCriteriaSnapshot: item.ratingCriteriaSnapshot }
                      : {}),
                  })),
                },
              }
            : {}),
        },
        include: {
          competencies: { orderBy: { competency: "asc" } },
          staffProfile: {
            select: {
              id: true,
              userId: true,
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
              jobTitle: true,
              department: true,
            },
          },
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: isSubmitting
          ? "STAFF_PERFORMANCE_REVIEW_SUBMITTED"
          : "STAFF_PERFORMANCE_REVIEW_UPDATED",
        resourceType: "StaffPerformanceReview",
        resourceId: review.id,
        metadata: {
          cycleId: review.cycleId,
          previousStatus: review.status,
          newStatus: updated.status,
          competencyCount: updated.competencies.length,
        },
      }, request);

      if (isSubmitting && updated.staffProfile.userId) {
        await createInAppNotification(tx, {
          schoolId,
          recipientUserId: updated.staffProfile.userId,
          type: "PERFORMANCE_REVIEW_SUBMITTED",
          title: "Performance review ready",
          message: `Your performance review for ${review.cycle.name} is ready for acknowledgement.`,
          href: `/hr/performance`,
          dedupeKey: `performance-review:${review.id}:submitted`,
        });
      }

      return { review: updated };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.statusCode });
    }

    return Response.json({ review: result.review });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to update performance review:", error);
    return Response.json(
      { error: "Unable to update the performance review." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId, reviewId } = await context.params;
    const authorization = await requireSchoolMembership(request.headers, schoolId);

    const review = await prisma.staffPerformanceReview.findFirst({
      where: { id: reviewId, schoolId },
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
        staffProfile: {
          select: {
            id: true,
            userId: true,
            employeeNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            jobTitle: true,
            department: true,
          },
        },
        reviewer: {
          select: { id: true, name: true },
        },
        competencies: {
          orderBy: { competency: "asc" },
        },
      },
    });

    if (!review) {
      return Response.json(
        { error: "Performance review not found in this school." },
        { status: 404 },
      );
    }

    const isManager = authorization.roles.some((role) =>
      MANAGERS.includes(role as (typeof MANAGERS)[number]),
    );
    const isAssignedReviewer = review.reviewerId === authorization.userId;
    const isEmployee = review.staffProfile.userId === authorization.userId;

    if (!isManager && !isAssignedReviewer && !isEmployee) {
      return Response.json(
        { error: "You are not authorized to view this review." },
        { status: 403 },
      );
    }

    if (
      isEmployee &&
      !isManager &&
      !isAssignedReviewer &&
      review.status !== StaffPerformanceReviewStatus.SUBMITTED &&
      review.status !== StaffPerformanceReviewStatus.ACKNOWLEDGED
    ) {
      return Response.json(
        { error: "This review is not yet available to the employee." },
        { status: 403 },
      );
    }

    const staffProfile = {
      id: review.staffProfile.id,
      employeeNumber: review.staffProfile.employeeNumber,
      firstName: review.staffProfile.firstName,
      middleName: review.staffProfile.middleName,
      lastName: review.staffProfile.lastName,
      jobTitle: review.staffProfile.jobTitle,
      department: review.staffProfile.department,
    };

    return Response.json({
      review: {
        ...review,
        staffProfile,
      },
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to retrieve performance review:", error);
    return Response.json(
      { error: "Unable to retrieve the performance review." },
      { status: 500 },
    );
  }
}
