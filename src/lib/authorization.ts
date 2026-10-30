import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { auth } from "./auth";
import { prisma } from "./db/prisma";

type RequestHeaders = Headers | HeadersInit;

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export class SchoolMembershipRequiredError extends Error {
  constructor() {
    super("Active school membership required");
    this.name = "SchoolMembershipRequiredError";
  }
}

export class InsufficientSchoolRoleError extends Error {
  constructor() {
    super("Insufficient school permissions");
    this.name = "InsufficientSchoolRoleError";
  }
}

export type SchoolAuthorization = {
  userId: string;
  schoolId: string;
  roles: SchoolMembershipRole[];
};

export async function requireSchoolMembership(
  headers: RequestHeaders,
  schoolId: string,
): Promise<SchoolAuthorization> {
  const session = await auth.api.getSession({
    headers: new Headers(headers),
  });

  if (!session?.user) {
    throw new AuthenticationRequiredError();
  }

  const memberships = await prisma.schoolMembership.findMany({
    where: {
      userId: session.user.id,
      schoolId,
      isActive: true,
    },
    select: {
      role: true,
    },
  });

  if (memberships.length === 0) {
    throw new SchoolMembershipRequiredError();
  }

  return {
    userId: session.user.id,
    schoolId,
    roles: memberships.map((membership) => membership.role),
  };
}

export async function requireSchoolRole(
  headers: RequestHeaders,
  schoolId: string,
  allowedRoles: SchoolMembershipRole[],
): Promise<SchoolAuthorization> {
  const authorization = await requireSchoolMembership(headers, schoolId);

  const hasRequiredRole = authorization.roles.some((role) =>
    allowedRoles.includes(role),
  );

  if (!hasRequiredRole) {
    throw new InsufficientSchoolRoleError();
  }

  return authorization;
}
