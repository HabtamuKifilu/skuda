import { NextRequest } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  let createdUserId: string | null = null;

  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [SchoolMembershipRole.OWNER],
    );

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { error: "Name, email, and password are required." },
        { status: 400 },
      );
    }

    const data = body as Record<string, unknown>;

    if (
      !isNonEmptyString(data.name) ||
      !isNonEmptyString(data.email) ||
      !isNonEmptyString(data.password)
    ) {
      return Response.json(
        { error: "Name, email, and password are required." },
        { status: 400 },
      );
    }

    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    const password = data.password;

    if (name.length < 2 || name.length > 100) {
      return Response.json(
        { error: "Name must contain 2 to 100 characters." },
        { status: 400 },
      );
    }

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (password.length < 8 || password.length > 128) {
      return Response.json(
        { error: "Password must contain 8 to 128 characters." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return Response.json(
        { error: "A user with this email already exists." },
        { status: 409 },
      );
    }

    const result = await auth.api.createUser({
      body: { name, email, password },
    });

    if (!result?.user) {
      return Response.json({ error: "Failed to create user." }, { status: 500 });
    }

    createdUserId = result.user.id;

    await prisma.$transaction(async (tx) => {
      await tx.schoolMembership.create({
        data: {
          userId: result.user.id,
          schoolId,
          role: SchoolMembershipRole.ADMIN,
          isActive: true,
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SCHOOL_ADMIN_CREATED",
          resourceType: "SchoolMembership",
          resourceId: result.user.id,
          metadata: {
            name,
            email,
            role: SchoolMembershipRole.ADMIN,
          },
        },
        request,
      );
    });

    return Response.json(
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          image: result.user.image,
        },
        membership: {
          schoolId,
          role: SchoolMembershipRole.ADMIN,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const response = authorizationErrorResponse(error);

    if (response) {
      return response;
    }

    if (createdUserId) {
      try {
        await prisma.user.delete({ where: { id: createdUserId } });
      } catch (cleanupError) {
        console.error("Failed to clean up user after admin creation failure:", cleanupError);
      }
    }

    console.error("Failed to create school admin:", error);

    return Response.json(
      { error: "Unable to create school admin. Check the submitted details and try again." },
      { status: 500 },
    );
  }
}
