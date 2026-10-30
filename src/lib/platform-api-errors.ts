import {
  InsufficientPlatformRoleError,
  PlatformAuthenticationRequiredError,
  PlatformMembershipRequiredError,
} from "./platform-authorization";

export function platformAuthorizationErrorResponse(
  error: unknown,
): Response | null {
  if (error instanceof PlatformAuthenticationRequiredError) {
    return Response.json(
      { error: error.message },
      { status: 401 },
    );
  }

  if (
    error instanceof PlatformMembershipRequiredError ||
    error instanceof InsufficientPlatformRoleError
  ) {
    return Response.json(
      { error: error.message },
      { status: 403 },
    );
  }

  return null;
}
