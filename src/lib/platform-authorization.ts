import { PlatformMembershipRole } from "@/generated/prisma/enums";
import { auth } from "./auth";
import { prisma } from "./db/prisma";

type RequestHeaders = Headers | HeadersInit;

export class PlatformAuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "PlatformAuthenticationRequiredError";
  }
}

export class PlatformMembershipRequiredError extends Error {
  constructor() {
    super("Active platform membership required");
    this.name = "PlatformMembershipRequiredError";
  }
}

export class InsufficientPlatformRoleError extends Error {
  constructor() {
    super("Insufficient platform permissions");
    this.name = "InsufficientPlatformRoleError";
  }
}

export type PlatformAuthorization = {
  userId: string;
  roles: PlatformMembershipRole[];
};

export async function requirePlatformMembership(
  headers: RequestHeaders,
): Promise<PlatformAuthorization> {
  const session = await auth.api.getSession({
    headers: new Headers(headers),
  });

  if (!session?.user) {
    throw new PlatformAuthenticationRequiredError();
  }

  const memberships = await prisma.platformMembership.findMany({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    select: {
      role: true,
    },
  });

  if (memberships.length === 0) {
    throw new PlatformMembershipRequiredError();
  }

  return {
    userId: session.user.id,
    roles: memberships.map((membership) => membership.role),
  };
}

export async function requirePlatformRole(
  headers: RequestHeaders,
  allowedRoles: PlatformMembershipRole[],
): Promise<PlatformAuthorization> {
  const authorization = await requirePlatformMembership(headers);

  const hasRequiredRole = authorization.roles.some((role) =>
    allowedRoles.includes(role),
  );

  if (!hasRequiredRole) {
    throw new InsufficientPlatformRoleError();
  }

  return authorization;
}
