import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type AuditDbClient = PrismaClient | Prisma.TransactionClient;

export type AuditLogInput = {
  actorId?: string | null;
  schoolId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  success?: boolean;
  errorCode?: string | null;
};

export function getAuditRequestContext(request: Request) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      null,
    userAgent: request.headers.get("user-agent")?.trim() || null,
  };
}

export async function createAuditLog(
  db: AuditDbClient,
  input: AuditLogInput,
  request?: Request,
) {
  const requestContext = request
    ? getAuditRequestContext(request)
    : {
        ipAddress: null,
        userAgent: null,
      };

  return db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      schoolId: input.schoolId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? undefined,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      success: input.success ?? true,
      errorCode: input.errorCode ?? null,
    },
  });
}
