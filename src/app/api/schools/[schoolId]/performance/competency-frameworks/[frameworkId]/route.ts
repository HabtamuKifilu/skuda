import { NextRequest, NextResponse } from "next/server";
import { SchoolMembershipRole } from "@/generated/prisma/enums";
import { createAuditLog } from "@/lib/audit-log";
import { requireSchoolRole } from "@/lib/authorization";
import { prisma } from "@/lib/db/prisma";

const MANAGERS = [
  SchoolMembershipRole.OWNER,
  SchoolMembershipRole.ADMIN,
  SchoolMembershipRole.HR_MANAGER,
] as const;

type CriteriaInput = {
  id?: string;
  name: string;
  description: string | null;
  rating1Criteria: string;
  rating2Criteria: string;
  rating3Criteria: string;
  rating4Criteria: string;
  rating5Criteria: string;
  sortOrder: number;
  isActive: boolean;
};

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length > max) return undefined;
  return normalized || null;
}

function parseCriteria(value: unknown): CriteriaInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    return null;
  }

  const result: CriteriaInput[] = [];
  const names = new Set<string>();
  const ids = new Set<string>();

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;

    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const key = name.toLocaleLowerCase();

    if (name.length < 2 || name.length > 120 || names.has(key)) return null;
    names.add(key);

    let id: string | undefined;
    if (row.id !== undefined) {
      if (typeof row.id !== "string" || !row.id.trim()) return null;
      id = row.id.trim();
      if (ids.has(id)) return null;
      ids.add(id);
    }

    const description =
      row.description === undefined ? null : optionalText(row.description, 2000);
    if (description === undefined) return null;

    const criteria: Record<string, string> = {};
    for (let rating = 1; rating <= 5; rating += 1) {
      const field = `rating${rating}Criteria`;
      const text = typeof row[field] === "string" ? row[field].trim() : "";
      if (text.length < 3 || text.length > 1000) return null;
      criteria[field] = text;
    }

    const sortOrder = row.sortOrder === undefined ? index : row.sortOrder;
    if (
      typeof sortOrder !== "number" ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 10000
    ) {
      return null;
    }

    const isActive = row.isActive === undefined ? true : row.isActive;
    if (typeof isActive !== "boolean") return null;

    result.push({
      id,
      name,
      description,
      ...criteria,
      sortOrder,
      isActive,
    } as CriteriaInput);
  }

  return result;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ schoolId: string; frameworkId: string }> },
) {
  const { schoolId, frameworkId } = await context.params;
  const authorization = await requireSchoolRole(
    request.headers,
    schoolId,
    [...MANAGERS],
  );

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const allowedKeys = new Set([
    "name",
    "description",
    "targetJobTitle",
    "targetDepartment",
    "isActive",
    "competencies",
  ]);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return NextResponse.json({ error: "Unsupported field supplied." }, { status: 400 });
  }

  const data: {
    name?: string;
    description?: string | null;
    targetJobTitle?: string | null;
    targetDepartment?: string | null;
    isActive?: boolean;
  } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "Invalid framework name." }, { status: 400 });
    }
    const name = body.name.trim();
    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Framework name must be 2–120 characters." }, { status: 400 });
    }
    data.name = name;
  }

  for (const field of ["description", "targetJobTitle", "targetDepartment"] as const) {
    if (body[field] === undefined) continue;
    const max = field === "description" ? 2000 : 120;
    const parsed = optionalText(body[field], max);
    if (parsed === undefined) {
      return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
    }
    data[field] = parsed;
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be a boolean." }, { status: 400 });
    }
    data.isActive = body.isActive;
  }

  const competencies =
    body.competencies === undefined ? undefined : parseCriteria(body.competencies);

  if (body.competencies !== undefined && !competencies) {
    return NextResponse.json(
      {
        error:
          "Competencies must contain 1–50 unique names with valid descriptions, five rating criteria, sort orders, and active flags.",
      },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffPerformanceCompetencyFramework.findFirst({
        where: { id: frameworkId, schoolId },
        select: { id: true, name: true },
      });

      if (!existing) throw new Error("FRAMEWORK_NOT_FOUND");

      if (competencies) {
        const suppliedIds = competencies.flatMap((item) => item.id ? [item.id] : []);
        if (suppliedIds.length > 0) {
          const matched = await tx.staffPerformanceCompetencyDefinition.findMany({
            where: { id: { in: suppliedIds }, schoolId, frameworkId },
            select: { id: true },
          });
          if (matched.length !== suppliedIds.length) {
            throw new Error("INVALID_COMPETENCY_IDS");
          }
        }

        for (const item of competencies) {
          const { id, ...fields } = item;
          if (id) {
            await tx.staffPerformanceCompetencyDefinition.update({
              where: { id },
              data: fields,
            });
          } else {
            await tx.staffPerformanceCompetencyDefinition.create({
              data: { ...fields, schoolId, frameworkId },
            });
          }
        }

        await tx.staffPerformanceCompetencyDefinition.updateMany({
          where: {
            schoolId,
            frameworkId,
            ...(suppliedIds.length
              ? { id: { notIn: suppliedIds } }
              : {}),
          },
          data: { isActive: false },
        });
      }

      return tx.staffPerformanceCompetencyFramework.update({
        where: { id_schoolId: { id: frameworkId, schoolId } },
        data,
        include: {
          competencies: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        },
      });
    });

    await createAuditLog(prisma, {
      actorId: authorization.userId,
      schoolId,
      action: "UPDATE",
      resourceType: "STAFF_PERFORMANCE_COMPETENCY_FRAMEWORK",
      resourceId: frameworkId,
      metadata: {
        frameworkName: updated.name,
        fieldsUpdated: Object.keys(data),
        competenciesReconciled: competencies !== undefined,
        competencyCount: updated.competencies.length,
      },
    }, request);

    return NextResponse.json({ framework: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "FRAMEWORK_NOT_FOUND") {
      return NextResponse.json({ error: "Framework not found." }, { status: 404 });
    }

    if (error instanceof Error && error.message === "INVALID_COMPETENCY_IDS") {
      return NextResponse.json(
        { error: "One or more competency IDs do not belong to this framework." },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A framework or competency with that name already exists." },
        { status: 409 },
      );
    }

    console.error("Performance competency framework update failed:", error);
    return NextResponse.json(
      { error: "Unable to update the competency framework." },
      { status: 500 },
    );
  }
}
