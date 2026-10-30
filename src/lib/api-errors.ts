import {
  AuthenticationRequiredError,
  InsufficientSchoolRoleError,
  SchoolMembershipRequiredError,
} from "./authorization";

export function authorizationErrorResponse(error: unknown): Response | null {
  if (error instanceof AuthenticationRequiredError) {
    return Response.json(
      { error: error.message },
      { status: 401 },
    );
  }

  if (
    error instanceof SchoolMembershipRequiredError ||
    error instanceof InsufficientSchoolRoleError
  ) {
    return Response.json(
      { error: error.message },
      { status: 403 },
    );
  }

  return null;
}
