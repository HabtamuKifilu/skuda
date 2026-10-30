import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
] as const;

const assignableRoles = [
  SchoolMembershipRole.ACADEMIC_HEAD,
  SchoolMembershipRole.ACCOUNTANT,
  SchoolMembershipRole.TEACHER,
  SchoolMembershipRole.REGISTRAR,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const membershipSelect = {
  id: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { schoolId } = await context.params;

    await requireSchoolRole(request.headers, schoolId, [...managementRoles]);

    const memberships = await prisma.schoolMembership.findMany({
      where: { schoolId },
      orderBy: [
        { isActive: "desc" },
        { createdAt: "asc" },
      ],
      select: membershipSelect,
    });

    return Response.json({ memberships });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to list school members:", error);
    return Response.json(
      { error: "Unable to load school members." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { schoolId } = await context.params;
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

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "Email and an allowed staff role are required." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;
    if (
      typeof data.email !== "string" ||
      !data.email.trim() ||
      typeof data.role !== "string" ||
      !assignableRoles.some((role) => role === data.role)
    ) {
      return Response.json(
        { error: "Enter an email address and a permitted staff role." },
        { status: 400 },
      );
    }

    const email = data.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const role = data.role as (typeof assignableRoles)[number];

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        staffProfile: {
          select: {
            id: true,
            schoolId: true,
            email: true,
            userId: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return Response.json(
        { error: "No existing account uses this email. Create the account and staff profile through the appropriate workflow first." },
        { status: 404 },
      );
    }

    const staffProfile = user.staffProfile;
    if (
      !staffProfile ||
      staffProfile.schoolId !== schoolId ||
      (staffProfile.userId !== null && staffProfile.userId !== user.id) ||
      (staffProfile.userId === null &&
        staffProfile.email?.trim().toLowerCase() !== email)
    ) {
      return Response.json(
        { error: "This account must be linked to a matching staff profile in this school before a staff role can be assigned." },
        { status: 409 },
      );
    }

    if (staffProfile.status === "TERMINATED") {
      return Response.json(
        { error: "A terminated employee cannot be assigned or reactivated for school access." },
        { status: 409 },
      );
    }

    const existing = await prisma.schoolMembership.findUnique({
      where: {
        userId_schoolId_role: {
          userId: user.id,
          schoolId,
          role,
        },
      },
      select: { id: true, isActive: true },
    });

    if (existing?.isActive) {
      return Response.json(
        { error: "This user already has this active role in the school." },
        { status: 409 },
      );
    }

    const membership = await prisma.$transaction(async (tx) => {
      const currentStaffProfile = await tx.staffProfile.findFirst({
        where: { id: staffProfile.id, schoolId },
        select: { status: true },
      });

      if (!currentStaffProfile) {
        throw new Error("STAFF_PROFILE_LINK_CONFLICT");
      }

      if (currentStaffProfile.status === "TERMINATED") {
        throw new Error("STAFF_PROFILE_TERMINATED");
      }

      if (staffProfile.userId === null) {
        const linked = await tx.staffProfile.updateMany({
          where: {
            id: staffProfile.id,
            schoolId,
            userId: null,
          },
          data: { userId: user.id },
        });

        if (linked.count !== 1) {
          throw new Error("STAFF_PROFILE_LINK_CONFLICT");
        }
      }

      const result = existing
        ? await tx.schoolMembership.update({
            where: { id: existing.id },
            data: { isActive: true },
            select: membershipSelect,
          })
        : await tx.schoolMembership.create({
            data: {
              userId: user.id,
              schoolId,
              role,
              isActive: true,
            },
            select: membershipSelect,
          });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: existing ? "SCHOOL_MEMBER_ROLE_REACTIVATED" : "SCHOOL_MEMBER_ROLE_ASSIGNED",
          resourceType: "SchoolMembership",
          resourceId: result.id,
          metadata: {
            userId: user.id,
            userEmail: user.email,
            role,
            operation: existing ? "REACTIVATED" : "CREATED",
          },
        },
        request,
      );

      return result;
    });

    return Response.json(
      { membership },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (error instanceof Error && error.message === "STAFF_PROFILE_TERMINATED") {
      return Response.json(
        { error: "This employee has been terminated and cannot regain school access." },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "STAFF_PROFILE_LINK_CONFLICT") {
      return Response.json(
        { error: "The staff profile changed during this request. Refresh and try again." },
        { status: 409 },
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        { error: "This role assignment already exists." },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message === "STAFF_PROFILE_LINK_CONFLICT") {
      return Response.json(
        { error: "The staff profile was linked by another request. Refresh and try again." },
        { status: 409 },
      );
    }

    console.error("Failed to assign school member role:", error);
    return Response.json(
      { error: "Unable to assign this staff role." },
      { status: 500 },
    );
  }
}
