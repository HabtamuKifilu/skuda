import { NextRequest } from "next/server";
import { PlatformMembershipRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { platformAuthorizationErrorResponse } from "@/lib/platform-api-errors";
import { requirePlatformRole } from "@/lib/platform-authorization";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(request: NextRequest) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const schoolId = request.nextUrl.searchParams.get("schoolId");

    if (schoolId) {
      const school = await prisma.school.findUnique({
        where: {
          id: schoolId,
        },
        select: {
          id: true,
        },
      });

      if (!school) {
        return Response.json(
          { error: "School not found" },
          { status: 404 },
        );
      }

      const users = await prisma.user.findMany({
        where: {
          memberships: {
            none: {
              schoolId,
              isActive: true,
            },
          },
        },
        orderBy: [
          { name: "asc" },
          { email: "asc" },
        ],
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });

      return Response.json({ users });
    }

    const users = await prisma.user.findMany({
      orderBy: [
        { name: "asc" },
        { email: "asc" },
      ],
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        banned: true,
        createdAt: true,
      },
    });

    return Response.json({ users });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Failed to list platform users:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePlatformRole(request.headers, [
      PlatformMembershipRole.PLATFORM_OWNER,
    ]);

    const body = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !isNonEmptyString(body.name) ||
      !isNonEmptyString(body.email) ||
      !isNonEmptyString(body.password)
    ) {
      return Response.json(
        {
          error: "Name, email, and password are required.",
        },
        { status: 400 },
      );
    }

    const name = body.name.trim();
    const email = body.email.trim().toLowerCase();
    const password = body.password;

    if (name.length < 2) {
      return Response.json(
        { error: "Name must contain at least 2 characters." },
        { status: 400 },
      );
    }

    if (name.length > 100) {
      return Response.json(
        { error: "Name must not exceed 100 characters." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return Response.json(
        { error: "Password must contain at least 8 characters." },
        { status: 400 },
      );
    }

    if (password.length > 128) {
      return Response.json(
        { error: "Password must not exceed 128 characters." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return Response.json(
        {
          error: "A user with this email already exists.",
        },
        { status: 409 },
      );
    }

    const result = await auth.api.createUser({
      body: {
        name,
        email,
        password,
      },
    });

    if (!result?.user) {
      return Response.json(
        { error: "Failed to create user." },
        { status: 500 },
      );
    }

    return Response.json(
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          image: result.user.image,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Failed to create platform user:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
