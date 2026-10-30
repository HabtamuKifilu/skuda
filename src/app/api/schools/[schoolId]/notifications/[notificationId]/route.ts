import { NextRequest } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { requireSchoolMembership } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = {
  params: Promise<{ schoolId: string; notificationId: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { schoolId, notificationId } = await context.params;
    const authorization = await requireSchoolMembership(request.headers, schoolId);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "A JSON request body is required." }, { status: 400 });
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !("read" in body) ||
      typeof body.read !== "boolean"
    ) {
      return Response.json(
        { error: 'Provide only a boolean "read" field.' },
        { status: 400 },
      );
    }

    const existing = await prisma.appNotification.findFirst({
      where: {
        id: notificationId,
        schoolId,
        recipientUserId: authorization.userId,
      },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ error: "Notification not found." }, { status: 404 });
    }

    const notification = await prisma.appNotification.update({
      where: { id: existing.id },
      data: { readAt: body.read ? new Date() : null },
      select: { id: true, readAt: true },
    });

    return Response.json({ notification });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to update notification:", error);
    return Response.json({ error: "Unable to update notification." }, { status: 500 });
  }
}
