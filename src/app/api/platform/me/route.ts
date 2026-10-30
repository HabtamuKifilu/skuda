import { NextRequest } from "next/server";
import { platformAuthorizationErrorResponse } from "@/lib/platform-api-errors";
import { requirePlatformMembership } from "@/lib/platform-authorization";

export async function GET(request: NextRequest) {
  try {
    const authorization = await requirePlatformMembership(
      request.headers,
    );

    return Response.json({
      userId: authorization.userId,
      roles: authorization.roles,
    });
  } catch (error) {
    const response = platformAuthorizationErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Failed to resolve platform context:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
