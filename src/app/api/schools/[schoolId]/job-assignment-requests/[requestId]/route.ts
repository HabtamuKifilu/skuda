import { NextRequest, NextResponse } from "next/server";
import {
  SchoolMembershipRole,
  StaffJobAssignmentRequestStatus,
  StaffStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";

type Context = {
  params: Promise<{ schoolId: string; requestId: string }>;
};

type ReviewAction = "APPROVE" | "REJECT" | "CANCEL";

function dateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function previousDay(value: Date): Date {
  const result = dateOnly(value);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

function isValidDateOnly(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, requestId } = await context.params;
    const auth = await requireSchoolRole(request.headers, schoolId, [
      SchoolMembershipRole.OWNER,
      SchoolMembershipRole.ADMIN,
      SchoolMembershipRole.HR_MANAGER,
    ]);

    let body: {
      action?: unknown;
      reviewNotes?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "A valid JSON request body is required." },
        { status: 400 },
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "The request body must be a JSON object." },
        { status: 400 },
      );
    }


    const action = body.action as ReviewAction;
    if (!["APPROVE", "REJECT", "CANCEL"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be APPROVE, REJECT, or CANCEL." },
        { status: 400 },
      );
    }

    const reviewNotes =
      typeof body.reviewNotes === "string" ? body.reviewNotes.trim() : "";

    if (body.reviewNotes !== undefined && typeof body.reviewNotes !== "string") {
      return NextResponse.json(
        { error: "Review notes must be text." },
        { status: 400 },
      );
    }

    if (reviewNotes.length > 2000) {
      return NextResponse.json(
        { error: "Review notes cannot exceed 2,000 characters." },
        { status: 400 },
      );
    }

    const isManager =
      auth.roles.includes(SchoolMembershipRole.OWNER) ||
      auth.roles.includes(SchoolMembershipRole.ADMIN);

    if ((action === "APPROVE" || action === "REJECT") && !isManager) {
      return NextResponse.json(
        { error: "Only a school OWNER or ADMIN can approve or reject requests." },
        { status: 403 },
      );
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const jobRequest = await tx.staffJobAssignmentRequest.findFirst({
        where: { id: requestId, schoolId },
        include: {
          staffProfile: true,
          jobTitle: true,
          department: true,
          reportingManager: true,
        },
      });

      if (!jobRequest) {
        return {
          error: "Job-assignment request not found.",
          status: 404,
        } as const;
      }

      if (jobRequest.status !== StaffJobAssignmentRequestStatus.PENDING) {
        return {
          error: "Only pending requests can be reviewed.",
          status: 409,
        } as const;
      }

      if (
        action === "CANCEL" &&
        !isManager &&
        jobRequest.requestedById !== auth.userId
      ) {
        return {
          error: "You can only cancel a request you submitted.",
          status: 403,
        } as const;
      }

      if (action === "APPROVE") {
        if (jobRequest.staffProfile.status !== StaffStatus.ACTIVE) {
          return {
            error: "The employee is no longer active. The request cannot be approved.",
            status: 409,
          } as const;
        }

        if (!jobRequest.jobTitle.isActive) {
          return {
            error: "The requested job title is inactive.",
            status: 409,
          } as const;
        }

        if (jobRequest.department && !jobRequest.department.isActive) {
          return {
            error: "The requested department is inactive.",
            status: 409,
          } as const;
        }

        if (
          jobRequest.reportingManager &&
          (jobRequest.reportingManager.status !== StaffStatus.ACTIVE ||
            jobRequest.reportingManager.id === jobRequest.staffProfileId)
        ) {
          return {
            error: "The reporting manager is invalid or no longer active.",
            status: 409,
          } as const;
        }

        const effectiveDate = dateOnly(jobRequest.effectiveDate);
        if (!isValidDateOnly(effectiveDate)) {
          return {
            error: "The request has an invalid effective date.",
            status: 409,
          } as const;
        }

        const sameDay = await tx.staffJobAssignment.findFirst({
          where: {
            schoolId,
            staffProfileId: jobRequest.staffProfileId,
            effectiveDate,
          },
          select: { id: true },
        });

        if (sameDay) {
          return {
            error:
              "An assignment already exists for this employee on the requested effective date. Resolve the date conflict before approval.",
            status: 409,
          } as const;
        }
      }

      const nextStatus =
        action === "APPROVE"
          ? StaffJobAssignmentRequestStatus.APPROVED
          : action === "REJECT"
            ? StaffJobAssignmentRequestStatus.REJECTED
            : StaffJobAssignmentRequestStatus.CANCELLED;

      // Claim the pending request atomically so two reviewers cannot both
      // process the same request. Any later failure rolls back this update.
      const claimed = await tx.staffJobAssignmentRequest.updateMany({
        where: {
          id: requestId,
          schoolId,
          status: StaffJobAssignmentRequestStatus.PENDING,
        },
        data: {
          status: nextStatus,
          reviewedById: auth.userId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null,
        },
      });

      if (claimed.count !== 1) {
        return {
          error: "This request has already been processed.",
          status: 409,
        } as const;
      }

      if (action === "APPROVE") {
        const effectiveDate = dateOnly(jobRequest.effectiveDate);

        const previous = await tx.staffJobAssignment.findFirst({
          where: {
            schoolId,
            staffProfileId: jobRequest.staffProfileId,
            effectiveDate: { lt: effectiveDate },
          },
          orderBy: { effectiveDate: "desc" },
          select: { id: true, effectiveDate: true, endDate: true },
        });

        const next = await tx.staffJobAssignment.findFirst({
          where: {
            schoolId,
            staffProfileId: jobRequest.staffProfileId,
            effectiveDate: { gt: effectiveDate },
          },
          orderBy: { effectiveDate: "asc" },
          select: { effectiveDate: true },
        });

        // Only close the predecessor if it still covers the new
        // effective date. Preserve historical end dates across gaps.
        if (
          previous &&
          (!previous.endDate || previous.endDate >= effectiveDate)
        ) {
          await tx.staffJobAssignment.update({
            where: { id: previous.id },
            data: { endDate: previousDay(effectiveDate) },
          });
        }

        await tx.staffJobAssignment.create({
          data: {
            schoolId,
            staffProfileId: jobRequest.staffProfileId,
            jobTitleId: jobRequest.jobTitleId,
            departmentId: jobRequest.departmentId,
            reportingManagerId: jobRequest.reportingManagerId,
            effectiveDate,
            endDate: next ? previousDay(next.effectiveDate) : null,
            approvedById: auth.userId,
            approvalRecordedAt: new Date(),
          },
        });

        // Legacy fields remain as compatibility copies. Only synchronize
        // them from the assignment effective today, never from a future one.
        const today = dateOnly(new Date());
        const currentAssignment = await tx.staffJobAssignment.findFirst({
          where: {
            schoolId,
            staffProfileId: jobRequest.staffProfileId,
            effectiveDate: { lte: today },
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
          orderBy: { effectiveDate: "desc" },
          include: {
            jobTitle: { select: { name: true } },
            department: { select: { name: true } },
          },
        });

        if (currentAssignment) {
          await tx.staffProfile.update({
            where: { id: jobRequest.staffProfileId },
            data: {
              jobTitle: currentAssignment.jobTitle.name,
              department: currentAssignment.department?.name ?? null,
            },
          });
        }
      }

      const auditAction =
        action === "APPROVE"
          ? "STAFF_JOB_ASSIGNMENT_APPROVED"
          : action === "REJECT"
            ? "STAFF_JOB_ASSIGNMENT_REJECTED"
            : "STAFF_JOB_ASSIGNMENT_CANCELLED";

      await createAuditLog(tx, {
        actorId: auth.userId,
        schoolId,
        action: auditAction,
        resourceType: "StaffJobAssignmentRequest",
        resourceId: requestId,
        metadata: {
          staffProfileId: jobRequest.staffProfileId,
          jobTitleId: jobRequest.jobTitleId,
          departmentId: jobRequest.departmentId,
          effectiveDate: jobRequest.effectiveDate.toISOString(),
          reviewNotes: reviewNotes || null,
        },
      }, request);

      return {
        status: 200,
        data: {
          id: requestId,
          status: nextStatus,
          reviewedAt: new Date().toISOString(),
        },
      } as const;
    });

    if ("error" in outcome) {
      return NextResponse.json(
        { error: outcome.error },
        { status: outcome.status },
      );
    }

    return NextResponse.json(outcome.data);
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to review job assignment request:", error);
    return NextResponse.json(
      { error: "Unable to process the job-assignment request." },
      { status: 500 },
    );
  }
}
