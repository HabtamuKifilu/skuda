import { NextRequest, NextResponse } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { authorizationErrorResponse } from "@/lib/api-errors";
import { createAuditLog } from "@/lib/audit-log";
import {
  requireSchoolMembership,
  requireSchoolRole,
} from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

type Context = { params: Promise<{ schoolId: string }> };

const MANAGERS = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const MANAGER_ROLES = [...MANAGERS];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    return undefined;
  }
  return value.trim();
}

function errorResponse(error: unknown): Response {
  const response = authorizationErrorResponse(error);
  if (response) return response;

  console.error("Performance competency framework API error:", error);
  return Response.json(
    { error: "Unable to process the competency framework request." },
    { status: 500 },
  );
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolMembership(
      request.headers,
      schoolId,
    );
    const isManager = authorization.roles.some((role) =>
      MANAGERS.includes(role as (typeof MANAGERS)[number]),
    );

    const staffProfileId =
      request.nextUrl.searchParams.get("staffProfileId")?.trim() || null;

    let targetProfile: { jobTitle: string | null; department: string | null } | null =
      null;

    if (staffProfileId) {
      targetProfile = await prisma.staffProfile.findFirst({
        where: { id: staffProfileId, schoolId },
        select: { jobTitle: true, department: true },
      });

      if (!targetProfile) {
        return Response.json(
          { error: "The selected staff profile was not found in this school." },
          { status: 404 },
        );
      }
    }

    const frameworks = await prisma.staffPerformanceCompetencyFramework.findMany({
      where: {
        schoolId,
        ...(isManager ? {} : { isActive: true }),
        ...(targetProfile
          ? {
              OR: [
                { targetJobTitle: null },
                { targetJobTitle: targetProfile.jobTitle ?? "__NO_MATCH__" },
              ],
              AND: [
                {
                  OR: [
                    { targetDepartment: null },
                    {
                      targetDepartment:
                        targetProfile.department ?? "__NO_MATCH__",
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ name: "asc" }],
      include: {
        competencies: {
          where: isManager ? {} : { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });

    return NextResponse.json({
      frameworks,
      isManager,
      currentUserId: authorization.userId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      MANAGER_ROLES,
    );

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    if (
      !isRecord(body) ||
      Object.keys(body).some(
        (key) =>
          ![
            "name",
            "description",
            "targetJobTitle",
            "targetDepartment",
            "competencies",
          ].includes(key),
      )
    ) {
      return Response.json(
        { error: "Provide a valid framework and competency definitions." },
        { status: 400 },
      );
    }

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const description = optionalText(body.description, 2000);
    const targetJobTitle = optionalText(body.targetJobTitle, 120);
    const targetDepartment = optionalText(body.targetDepartment, 120);

    if (
      name.length < 2 ||
      name.length > 120 ||
      description === undefined ||
      targetJobTitle === undefined ||
      targetDepartment === undefined ||
      !Array.isArray(body.competencies) ||
      body.competencies.length < 1 ||
      body.competencies.length > 50
    ) {
      return Response.json(
        {
          error:
            "Provide a framework name, valid optional details, and between 1 and 50 competencies.",
        },
        { status: 400 },
      );
    }

    const seenNames = new Set<string>();
    const competencies: {
      name: string;
      description: string | null;
      rating1Criteria: string;
      rating2Criteria: string;
      rating3Criteria: string;
      rating4Criteria: string;
      rating5Criteria: string;
      sortOrder: number;
    }[] = [];

    for (let index = 0; index < body.competencies.length; index += 1) {
      const item = body.competencies[index];

      if (!isRecord(item)) {
        return Response.json(
          { error: `Competency ${index + 1} must be an object.` },
          { status: 400 },
        );
      }

      const competencyName =
        typeof item.name === "string" ? item.name.trim() : "";
      const key = competencyName.toLocaleLowerCase();

      const competencyDescription = optionalText(item.description, 2000);
      const criteria = [
        item.rating1Criteria,
        item.rating2Criteria,
        item.rating3Criteria,
        item.rating4Criteria,
        item.rating5Criteria,
      ];

      if (
        competencyName.length < 2 ||
        competencyName.length > 120 ||
        seenNames.has(key) ||
        competencyDescription === undefined ||
        criteria.some(
          (criterion) =>
            typeof criterion !== "string" ||
            criterion.trim().length < 3 ||
            criterion.trim().length > 1000,
        )
      ) {
        return Response.json(
          {
            error: `Competency ${index + 1} has an invalid or duplicate name, description, or rating criterion.`,
          },
          { status: 400 },
        );
      }

      const allowedKeys = [
        "name",
        "description",
        "rating1Criteria",
        "rating2Criteria",
        "rating3Criteria",
        "rating4Criteria",
        "rating5Criteria",
      ];

      if (Object.keys(item).some((keyName) => !allowedKeys.includes(keyName))) {
        return Response.json(
          { error: `Competency ${index + 1} contains unsupported fields.` },
          { status: 400 },
        );
      }

      seenNames.add(key);
      competencies.push({
        name: competencyName,
        description: competencyDescription ?? null,
        rating1Criteria: (criteria[0] as string).trim(),
        rating2Criteria: (criteria[1] as string).trim(),
        rating3Criteria: (criteria[2] as string).trim(),
        rating4Criteria: (criteria[3] as string).trim(),
        rating5Criteria: (criteria[4] as string).trim(),
        sortOrder: index,
      });
    }

    const framework = await prisma.$transaction(async (tx) => {
      const created = await tx.staffPerformanceCompetencyFramework.create({
        data: {
          schoolId,
          name,
          description: description ?? null,
          targetJobTitle: targetJobTitle ?? null,
          targetDepartment: targetDepartment ?? null,
          createdById: authorization.userId,
          competencies: {
            create: competencies.map((competency) => ({
              schoolId,
              ...competency,
            })),
          },
        },
        include: {
          competencies: {
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          },
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "CREATE",
          resourceType: "STAFF_PERFORMANCE_COMPETENCY_FRAMEWORK",
          resourceId: created.id,
          metadata: {
            name: created.name,
            competencyCount: competencies.length,
            targetJobTitle: created.targetJobTitle,
            targetDepartment: created.targetDepartment,
          },
        },
        request,
      );

      return created;
    });

    return NextResponse.json({ framework }, { status: 201 });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (
      isRecord(error) &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A framework with this name already exists in this school." },
        { status: 409 },
      );
    }

    return errorResponse(error);
  }
}
