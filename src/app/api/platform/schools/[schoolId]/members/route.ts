import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import {
  PlatformMembershipRole,
  SchoolMembershipRole,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { platformAuthorizationErrorResponse } from "@/lib/platform-api-errors";
import { requirePlatformRole } from "@/lib/platform-authorization";
import { createAuditLog } from "@/lib/audit-log";

type RouteContext = {
  params: Promise<{
    schoolId: string;
  }>;
};

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
  { params }: RouteContext,
) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const { schoolId } = await params;

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true },
    });

    if (!school) {
      return Response.json(
        { error: "School not found" },
        { status: 404 },
      );
    }

    const memberships = await prisma.schoolMembership.findMany({
      where: {
        schoolId,
      },
      orderBy: [
        { isActive: "desc" },
        { createdAt: "asc" },
      ],
      select: membershipSelect,
    });

    return Response.json({ memberships });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Failed to list school members:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}


export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const authorization = await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const { schoolId } = await params;

    const body = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.userId !== "string" ||
      body.userId.trim().length === 0 ||
      body.role !== SchoolMembershipRole.OWNER
    ) {
      return Response.json(
        {
          error:
            "This platform operation can only assign a school owner.",
        },
        { status: 400 },
      );
    }

    const userId = body.userId.trim();

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    if (!school) {
      return Response.json(
        { error: "School not found" },
        { status: 404 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    if (!user) {
      return Response.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    const existingOwner = await prisma.schoolMembership.findFirst({
      where: {
        schoolId,
        role: SchoolMembershipRole.OWNER,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (existingOwner) {
      if (existingOwner.userId === userId) {
        return Response.json(
          { error: "This user is already the school owner." },
          { status: 409 },
        );
      }

      return Response.json(
        {
          error:
            "This school already has an active owner. Ownership changes must be handled through the dedicated ownership process.",
        },
        { status: 409 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingMembership =
        await tx.schoolMembership.findUnique({
          where: {
            userId_schoolId_role: {
              userId,
              schoolId,
              role: SchoolMembershipRole.OWNER,
            },
          },
          select: {
            id: true,
            isActive: true,
          },
        });

      if (existingMembership) {
        const membership = await tx.schoolMembership.update({
          where: {
            id: existingMembership.id,
          },
          data: {
            isActive: true,
          },
          select: membershipSelect,
        });

        await createAuditLog(
          tx,
          {
            actorId: authorization.userId,
            schoolId: school.id,
            action: "SCHOOL_OWNER_ASSIGNED",
            resourceType: "SchoolMembership",
            resourceId: membership.id,
            metadata: {
              schoolName: school.name,
              schoolCode: school.code,
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              role: SchoolMembershipRole.OWNER,
              operation: "REACTIVATED",
            },
          },
          request,
        );

        return {
          membership,
          status: 200 as const,
        };
      }

      const membership = await tx.schoolMembership.create({
        data: {
          userId,
          schoolId,
          role: SchoolMembershipRole.OWNER,
        },
        select: membershipSelect,
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId: school.id,
          action: "SCHOOL_OWNER_ASSIGNED",
          resourceType: "SchoolMembership",
          resourceId: membership.id,
          metadata: {
            schoolName: school.name,
            schoolCode: school.code,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            role: SchoolMembershipRole.OWNER,
            operation: "CREATED",
          },
        },
        request,
      );

      return {
        membership,
        status: 201 as const,
      };
    });

    return Response.json(
      { membership: result.membership },
      { status: result.status },
    );
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        { error: "This school owner assignment already exists." },
        { status: 409 },
      );
    }

    console.error("Failed to assign school owner:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
