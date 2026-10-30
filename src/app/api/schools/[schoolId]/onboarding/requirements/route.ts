import { NextRequest } from "next/server";
import {
  SchoolMembershipRole,
  StaffDocumentType,
  StaffOnboardingRequirementType,
} from "@/generated/prisma/client";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

const managementRoles = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textField(
  value: unknown,
  label: string,
  maxLength: number,
  required = true,
): { value: string } | { error: string } {
  if (typeof value !== "string") {
    return { error: `${label} must be text.` };
  }

  const normalized = value.trim();

  if (required && !normalized) {
    return { error: `${label} is required.` };
  }

  if (normalized.length > maxLength) {
    return { error: `${label} must not exceed ${maxLength} characters.` };
  }

  return { value: normalized };
}

function optionalBoolean(
  data: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean | null {
  if (!(key in data)) return fallback;
  return typeof data[key] === "boolean" ? data[key] as boolean : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;

    await requireSchoolRole(request.headers, schoolId, [...managementRoles]);

    const [documentRequirements, onboardingRequirements] = await Promise.all([
      prisma.staffDocumentRequirement.findMany({
        where: { schoolId },
        orderBy: [{ isActive: "desc" }, { title: "asc" }],
      }),
      prisma.staffOnboardingRequirement.findMany({
        where: { schoolId },
        orderBy: [
          { isActive: "desc" },
          { type: "asc" },
          { title: "asc" },
        ],
      }),
    ]);

    return Response.json({ documentRequirements, onboardingRequirements });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to load staff onboarding requirements:", error);
    return Response.json(
      { error: "Unable to load onboarding requirements." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...managementRoles],
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!isRecord(body) || (body.kind !== "document" && body.kind !== "onboarding")) {
      return Response.json(
        { error: "Choose a document or onboarding requirement." },
        { status: 400 },
      );
    }

    const required = optionalBoolean(body, "required", true);
    const isActive = optionalBoolean(body, "isActive", true);

    if (required === null || isActive === null) {
      return Response.json(
        { error: "Required and active must be true or false." },
        { status: 400 },
      );
    }

    if (body.kind === "document") {
      if (
        typeof body.documentType !== "string" ||
        !Object.values(StaffDocumentType).includes(body.documentType as StaffDocumentType)
      ) {
        return Response.json({ error: "Select a valid document type." }, { status: 400 });
      }

      const title = textField(body.title, "Document title", 120);
      if ("error" in title) {
        return Response.json({ error: title.error }, { status: 400 });
      }

      const notes = body.notes === undefined
        ? { value: null as string | null }
        : body.notes === null
          ? { value: null as string | null }
          : typeof body.notes === "string"
            ? textField(body.notes, "Notes", 1000, false)
            : { error: "Notes must be text or null." };

      if ("error" in notes) {
        return Response.json({ error: notes.error }, { status: 400 });
      }

      const documentType = body.documentType as StaffDocumentType;

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.staffDocumentRequirement.findUnique({
          where: { schoolId_documentType: { schoolId, documentType } },
          select: { id: true },
        });

        const requirement = await tx.staffDocumentRequirement.upsert({
          where: { schoolId_documentType: { schoolId, documentType } },
          create: {
            schoolId,
            documentType,
            title: title.value,
            required,
            isActive,
            notes: notes.value,
          },
          update: {
            title: title.value,
            required,
            isActive,
            notes: notes.value,
          },
        });

        await createAuditLog(tx, {
          actorId: authorization.userId,
          schoolId,
          action: existing
            ? "STAFF_DOCUMENT_REQUIREMENT_UPDATED"
            : "STAFF_DOCUMENT_REQUIREMENT_CREATED",
          resourceType: "StaffDocumentRequirement",
          resourceId: requirement.id,
          metadata: {
            documentType,
            title: requirement.title,
            required: requirement.required,
            isActive: requirement.isActive,
          },
        }, request);

        return requirement;
      });

      return Response.json({ requirement: result }, { status: 200 });
    }

    const code = textField(body.code, "Requirement code", 80);
    const title = textField(body.title, "Requirement title", 120);
    const version = body.version === undefined
      ? { value: "1" }
      : textField(body.version, "Version", 40);

    if ("error" in code) return Response.json({ error: code.error }, { status: 400 });
    if ("error" in title) return Response.json({ error: title.error }, { status: 400 });
    if ("error" in version) return Response.json({ error: version.error }, { status: 400 });

    if (
      typeof body.type !== "string" ||
      !Object.values(StaffOnboardingRequirementType).includes(
        body.type as StaffOnboardingRequirementType,
      )
    ) {
      return Response.json(
        { error: "Choose orientation or policy acknowledgement." },
        { status: 400 },
      );
    }

    const description = body.description === undefined || body.description === null
      ? { value: null as string | null }
      : typeof body.description === "string"
        ? textField(body.description, "Description", 2000, false)
        : { error: "Description must be text or null." };

    if ("error" in description) {
      return Response.json({ error: description.error }, { status: 400 });
    }

    const type = body.type as StaffOnboardingRequirementType;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffOnboardingRequirement.findUnique({
        where: { schoolId_code: { schoolId, code: code.value } },
        select: { id: true },
      });

      const requirement = await tx.staffOnboardingRequirement.upsert({
        where: { schoolId_code: { schoolId, code: code.value } },
        create: {
          schoolId,
          code: code.value,
          type,
          title: title.value,
          description: description.value,
          version: version.value,
          required,
          isActive,
        },
        update: {
          type,
          title: title.value,
          description: description.value,
          version: version.value,
          required,
          isActive,
        },
      });

      await createAuditLog(tx, {
        actorId: authorization.userId,
        schoolId,
        action: existing
          ? "STAFF_ONBOARDING_REQUIREMENT_UPDATED"
          : "STAFF_ONBOARDING_REQUIREMENT_CREATED",
        resourceType: "StaffOnboardingRequirement",
        resourceId: requirement.id,
        metadata: {
          code: requirement.code,
          type: requirement.type,
          title: requirement.title,
          version: requirement.version,
          required: requirement.required,
          isActive: requirement.isActive,
        },
      }, request);

      return requirement;
    });

    return Response.json({ requirement: result }, { status: 200 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to save staff onboarding requirement:", error);
    return Response.json(
      { error: "Unable to save the onboarding requirement." },
      { status: 500 },
    );
  }
}
