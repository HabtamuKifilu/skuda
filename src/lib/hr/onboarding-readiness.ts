import { Prisma } from "@/generated/prisma/client";

export type OnboardingReadiness = {
  onboardingId: string;
  completedAt: Date | null;
  ready: boolean;
  blockers: string[];
};

export async function getOnboardingReadiness(
  tx: Prisma.TransactionClient,
  schoolId: string,
  onboardingId: string,
): Promise<OnboardingReadiness | null> {
  const plan = await tx.staffOnboarding.findFirst({
    where: { id: onboardingId, schoolId },
    include: {
      staffProfile: {
        include: {
          employment: true,
          documents: {
            select: {
              documentType: true,
              reviewStatus: true,
              expiryDate: true,
            },
          },
        },
      },
      tasks: {
        select: { id: true, title: true, status: true },
      },
      acknowledgements: {
        select: { requirementId: true },
      },
      probationReviews: {
        select: {
          id: true,
          reviewDueDate: true,
          probationEndDate: true,
          outcome: true,
          nextReviewDate: true,
        },
      },
      accountAccessRequests: {
        select: { status: true },
      },
    },
  });

  if (!plan) return null;

  const blockers: string[] = [];
  const employee = plan.staffProfile;
  const employment = employee.employment;

  if (!employment?.startDate) {
    blockers.push("Record the employee's employment start date.");
  }

  if (!employee.jobTitle?.trim()) {
    blockers.push("Assign the employee a job title.");
  }

  if (!employee.department?.trim()) {
    blockers.push("Assign the employee to a department.");
  }

  if (plan.tasks.length === 0) {
    blockers.push("Add at least one onboarding checklist task.");
  } else {
    const outstanding = plan.tasks.filter((task) => task.status !== "COMPLETED");
    if (outstanding.length) {
      blockers.push(
        `Complete the ${outstanding.length} outstanding checklist task(s).`,
      );
    }
  }

  const documentRequirements = await tx.staffDocumentRequirement.findMany({
    where: { schoolId, isActive: true, required: true },
    select: { documentType: true, title: true },
  });

  if (documentRequirements.length === 0) {
    blockers.push("Configure at least one active required-document policy.");
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const requirement of documentRequirements) {
    const approved = employee.documents.some((document) =>
      document.documentType === requirement.documentType &&
      document.reviewStatus === "APPROVED" &&
      (!document.expiryDate ||
        new Date(document.expiryDate).getTime() >= today.getTime()),
    );

    if (!approved) {
      blockers.push(
        `Upload and obtain approval for a valid ${requirement.title} document.`,
      );
    }
  }

  const onboardingRequirements = await tx.staffOnboardingRequirement.findMany({
    where: { schoolId, isActive: true, required: true },
    select: { id: true, title: true },
  });

  if (onboardingRequirements.length === 0) {
    blockers.push("Configure the required orientation and policy acknowledgements.");
  }

  const acknowledged = new Set(
    plan.acknowledgements.map((item) => item.requirementId),
  );

  for (const requirement of onboardingRequirements) {
    if (!acknowledged.has(requirement.id)) {
      blockers.push(
        `Record the required acknowledgement: ${requirement.title}.`,
      );
    }
  }

  if (employment?.employmentType === "PROBATION") {
    if (plan.probationReviews.length === 0) {
      blockers.push("Schedule a probation review with its review due date.");
    } else {
      if (plan.probationReviews.some((review) => review.outcome === "PENDING")) {
        blockers.push("Finalize every scheduled probation review.");
      }

      if (plan.probationReviews.some((review) =>
        !review.probationEndDate ||
        (review.outcome === "EXTENDED" && !review.nextReviewDate)
      )) {
        blockers.push("Ensure probation reviews have an end date and extensions have a next review date.");
      }
    }
  }

  if (
    plan.accountAccessRequired &&
    !plan.accountAccessRequests.some((item) => item.status === "APPROVED")
  ) {
    blockers.push("Obtain owner/admin approval for the required account access.");
  }

  return {
    onboardingId: plan.id,
    completedAt: plan.completedAt,
    ready: blockers.length === 0,
    blockers,
  };
}
