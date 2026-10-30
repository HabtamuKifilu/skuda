import { NextRequest } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { requireSchoolMembership } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = { params: Promise<{ schoolId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolMembership(request.headers, schoolId);
    const params = request.nextUrl.searchParams;
    const unreadOnly = params.get("unread") === "true";
    const rawLimit = Number(params.get("limit") ?? 30);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(100, Math.max(1, Math.floor(rawLimit)))
      : 30;

    const where = {
      schoolId,
      recipientUserId: authorization.userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.appNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          href: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.appNotification.count({
        where: {
          schoolId,
          recipientUserId: authorization.userId,
          readAt: null,
        },
      }),
    ]);

    return Response.json({ notifications, unreadCount });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;
    console.error("Failed to list notifications:", error);
    return Response.json({ error: "Unable to load notifications." }, { status: 500 });
  }
}
