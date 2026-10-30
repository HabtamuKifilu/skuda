import { NextRequest } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { requireSchoolContext } from "@/lib/school-context";

type RouteContext = {
  params: Promise<{
    schoolId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { schoolId } = await context.params;

    const authorization = await requireSchoolContext(
      request.headers,
      schoolId,
    );

    return Response.json({
      userId: authorization.userId,
      schoolId: authorization.schoolId,
      roles: authorization.roles,
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);

    if (response) {
      return response;
    }

    console.error("Failed to resolve school context:", error);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
