import { NextRequest } from "next/server";
import {
  Prisma,
  SchoolMembershipRole,
  StaffAccountAccessRequestStatus,
} from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string; requestId: string }>;
};

const approverRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId, requestId } = await context.params;

    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...approverRoles],
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    if (
      !isRecord(body) ||
      (body.decision !== "APPROVED" && body.decision !== "REJECTED")
    ) {
      return Response.json(
        { error: "Choose APPROVED or REJECTED." },
        { status: 400 },
      );
    }

    if (
      body.reviewNotes !== undefined &&
      body.reviewNotes !== null &&
      typeof body.reviewNotes !== "string"
    ) {
      return Response.json(
        { error: "Review notes must be text or null." },
        { status: 400 },
      );
    }

    const reviewNotes =
      typeof body.reviewNotes === "string"
        ? body.reviewNotes.trim()
        : "";

    if (reviewNotes.length > 2000) {
      return Response.json(
        { error: "Review notes must not exceed 2000 characters." },
        { status: 400 },
      );
    }

    if (body.decision === "REJECTED" && !reviewNotes) {
      return Response.json(
        { error: "A reason is required when rejecting an access request." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const accessRequest = await tx.staffAccountAccessRequest.findFirst({
        where: { id: requestId, schoolId },
        include: {
          staffProfile: {
            select: {
              id: true,
              schoolId: true,
              userId: true,
              email: true,
              status: true,
              firstName: true,
              lastName: true,
            },
          },
          onboarding: {
            select: {
              id: true,
              completedAt: true,
            },
          },
        },
      });

      if (!accessRequest) {
        return { kind: "missing" as const };
      }

      if (accessRequest.status !== StaffAccountAccessRequestStatus.PENDING) {
        return { kind: "already-reviewed" as const };
      }

      if (
        !requestableRoles.some(
          (role) => role === accessRequest.requestedRole,
        )
      ) {
        return { kind: "invalid-role" as const };
      }

      if (body.decision === "REJECTED") {
        const claimed = await tx.staffAccountAccessRequest.updateMany({
          where: {
            id: requestId,
            schoolId,
            status: StaffAccountAccessRequestStatus.PENDING,
          },
          data: {
            status: StaffAccountAccessRequestStatus.REJECTED,
            reviewedById: authorization.userId,
            reviewedAt: new Date(),
            reviewNotes,
          },
        });

        if (claimed.count !== 1) {
          return { kind: "already-reviewed" as const };
        }

        await createAuditLog(
          tx,
          {
            actorId: authorization.userId,
            schoolId,
            action: "STAFF_ACCOUNT_ACCESS_REJECTED",
            resourceType: "StaffAccountAccessRequest",
            resourceId: requestId,
            metadata: {
              onboardingId: accessRequest.onboardingId,
              staffProfileId: accessRequest.staffProfileId,
              requestedRole: accessRequest.requestedRole,
              reviewNotes,
            },
          },
          request,
        );

        return {
          kind: "rejected" as const,
          request: await tx.staffAccountAccessRequest.findUniqueOrThrow({
            where: { id: requestId },
          }),
        };
      }

      if (accessRequest.onboarding.completedAt) {
        return { kind: "onboarding-completed" as const };
      }

      const profile = accessRequest.staffProfile;

      if (profile.status === "TERMINATED") {
        return { kind: "terminated" as const };
      }

      let user = profile.userId
        ? await tx.user.findUnique({
            where: { id: profile.userId },
            select: {
              id: true,
              email: true,
              staffProfile: {
                select: { id: true, schoolId: true },
              },
            },
          })
        : null;

      const profileEmail = profile.email?.trim().toLowerCase() ?? "";

      if (!user && !profile.userId && profileEmail) {
        user = await tx.user.findUnique({
          where: { email: profileEmail },
          select: {
            id: true,
            email: true,
            staffProfile: {
              select: { id: true, schoolId: true },
            },
          },
        });
      }

      if (!user) {
        return { kind: "account-not-found" as const };
      }

      if (
        (profile.userId !== null && user.id !== profile.userId) ||
        user.email.trim().toLowerCase() !== profileEmail ||
        (user.staffProfile !== null &&
          (user.staffProfile.id !== profile.id ||
            user.staffProfile.schoolId !== schoolId))
      ) {
        return { kind: "account-mismatch" as const };
      }

      if (!profile.userId) {
        const linked = await tx.staffProfile.updateMany({
          where: {
            id: profile.id,
            schoolId,
            userId: null,
            status: { not: "TERMINATED" },
          },
          data: { userId: user.id },
        });

        if (linked.count !== 1) {
          return { kind: "profile-link-conflict" as const };
        }
      }

      const role = accessRequest.requestedRole;

      const existingMembership = await tx.schoolMembership.findUnique({
        where: {
          userId_schoolId_role: {
            userId: user.id,
            schoolId,
            role,
          },
        },
        select: { id: true, isActive: true },
      });

      const membership = existingMembership
        ? existingMembership.isActive
          ? existingMembership
          : await tx.schoolMembership.update({
              where: { id: existingMembership.id },
              data: { isActive: true },
              select: { id: true, isActive: true },
            })
        : await tx.schoolMembership.create({
            data: {
              userId: user.id,
              schoolId,
              role,
              isActive: true,
            },
            select: { id: true, isActive: true },
          });

      if (!existingMembership || !existingMembership.isActive) {
        await createAuditLog(
          tx,
          {
            actorId: authorization.userId,
            schoolId,
            action: existingMembership
              ? "SCHOOL_MEMBER_ROLE_REACTIVATED"
              : "SCHOOL_MEMBER_ROLE_ASSIGNED",
            resourceType: "SchoolMembership",
            resourceId: membership.id,
            metadata: {
              userId: user.id,
              userEmail: user.email,
              role,
              source: "STAFF_ONBOARDING_ACCESS_APPROVAL",
              accessRequestId: requestId,
            },
          },
          request,
        );
      }

      const claimed = await tx.staffAccountAccessRequest.updateMany({
        where: {
          id: requestId,
          schoolId,
          status: StaffAccountAccessRequestStatus.PENDING,
        },
        data: {
          status: StaffAccountAccessRequestStatus.APPROVED,
          reviewedById: authorization.userId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null,
        },
      });

      if (claimed.count !== 1) {
        throw new Error("STAFF_ACCESS_REQUEST_REVIEW_CONFLICT");
      }

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "STAFF_ACCOUNT_ACCESS_APPROVED",
          resourceType: "StaffAccountAccessRequest",
          resourceId: requestId,
          metadata: {
            onboardingId: accessRequest.onboardingId,
            staffProfileId: profile.id,
            userId: user.id,
            role,
            membershipId: membership.id,
            membershipWasAlreadyActive:
              existingMembership?.isActive === true,
          },
        },
        request,
      );

      return {
        kind: "approved" as const,
        accessRequest: await tx.staffAccountAccessRequest.findUniqueOrThrow({
          where: { id: requestId },
        }),
        membership,
      };
    });

    switch (result.kind) {
      case "missing":
        return Response.json(
          { error: "Access request not found in this school." },
          { status: 404 },
        );
      case "already-reviewed":
        return Response.json(
          { error: "This access request has already been reviewed." },
          { status: 409 },
        );
      case "invalid-role":
        return Response.json(
          { error: "This request contains a role that cannot be assigned through onboarding." },
          { status: 409 },
        );
      case "onboarding-completed":
        return Response.json(
          { error: "The onboarding plan is already complete." },
          { status: 409 },
        );
      case "terminated":
        return Response.json(
          { error: "A terminated employee cannot receive school access." },
          { status: 409 },
        );
      case "account-not-found":
        return Response.json(
          { error: "No existing user account matches the employee's email. Create the account through the approved account-provisioning workflow first." },
          { status: 404 },
        );
      case "account-mismatch":
        return Response.json(
          { error: "The user account does not match this employee's school profile and email." },
          { status: 409 },
        );
      case "profile-link-conflict":
        return Response.json(
          { error: "The employee profile changed during approval. Refresh and retry." },
          { status: 409 },
        );
      case "rejected":
        return Response.json({ accessRequest: result.request });
      case "approved":
        return Response.json({
          accessRequest: result.accessRequest,
          membership: result.membership,
        });
    }
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (
      error instanceof Error &&
      error.message === "STAFF_ACCESS_REQUEST_REVIEW_CONFLICT"
    ) {
      return Response.json(
        { error: "The access request changed during approval. Refresh and retry." },
        { status: 409 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "The role assignment already exists. Refresh the request and review its current status." },
        { status: 409 },
      );
    }

    console.error("Failed to review staff account access request:", error);
    return Response.json(
      { error: "Unable to review the staff account access request." },
      { status: 500 },
    );
  }
}
