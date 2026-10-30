import { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { EmploymentChangeType, SchoolMembershipRole, StaffStatus } from "@/generated/prisma/enums";
import { auth } from "@/lib/auth";
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
] as const;

const staffCreationRoles = [
  ...managementRoles,
  SchoolMembershipRole.HR_MANAGER,
] as const;

const assignableRoles = [
  SchoolMembershipRole.ACADEMIC_HEAD,
  SchoolMembershipRole.ACCOUNTANT,
  SchoolMembershipRole.TEACHER,
  SchoolMembershipRole.REGISTRAR,
  SchoolMembershipRole.HR_MANAGER,
] as const;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}


export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await context.params;

    await requireSchoolRole(
      request.headers,
      schoolId,
      [...staffCreationRoles],
    );

    const params = new URL(request.url).searchParams;
    const rawSearch = (params.get("q") ?? "").trim();
    const search = rawSearch.slice(0, 100);
    const rawDepartment = (params.get("department") ?? "").trim();
    const department = rawDepartment.slice(0, 100);
    const rawStatus = (params.get("status") ?? "").trim().toUpperCase();

    if (
      rawStatus &&
      !Object.values(StaffStatus).includes(rawStatus as StaffStatus)
    ) {
      return Response.json(
        { error: "Invalid staff status filter." },
        { status: 400 },
      );
    }

    const parsePositiveInt = (
      value: string | null,
      fallback: number,
      maximum: number,
    ) => {
      if (value === null || !/^\d+$/.test(value)) return fallback;
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
      return Math.min(parsed, maximum);
    };

    const page = parsePositiveInt(params.get("page"), 1, 100000);
    const pageSize = parsePositiveInt(params.get("pageSize"), 20, 100);

    const where: Prisma.StaffProfileWhereInput = {
      schoolId,
      ...(rawStatus ? { status: rawStatus as StaffStatus } : {}),
      ...(department ? { department } : {}),
      ...(search
        ? {
            OR: [
              { employeeNumber: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { middleName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { jobTitle: { contains: search, mode: "insensitive" } },
              { department: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [staff, total, statusGroups, departmentRows] = await Promise.all([
      prisma.staffProfile.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          middleName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
          department: true,
          status: true,
          hireDate: true,
        },
      }),
      prisma.staffProfile.count({ where }),
      prisma.staffProfile.groupBy({
        by: ["status"],
        where: { schoolId },
        _count: { _all: true },
      }),
      prisma.staffProfile.findMany({
        where: { schoolId, department: { not: null } },
        distinct: ["department"],
        orderBy: { department: "asc" },
        select: { department: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      Object.values(StaffStatus).map((status) => [status, 0]),
    ) as Record<StaffStatus, number>;

    for (const group of statusGroups) {
      statusCounts[group.status] = group._count._all;
    }

    return Response.json({
      staff,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      statusCounts,
      departments: departmentRows
        .map((row) => row.department)
        .filter((value): value is string => Boolean(value)),
    });
  } catch (error) {
    const response = authorizationErrorResponse(error);
    if (response) return response;

    console.error("Failed to list school staff:", error);
    return Response.json(
      { error: "Unable to load the staff directory." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  let createdUserId: string | null = null;

  try {
    const { schoolId } = await context.params;
    const authorization = await requireSchoolRole(
      request.headers,
      schoolId,
      [...staffCreationRoles],
    );
    const canManageStaff = authorization.roles.some(
      (role) =>
        role === SchoolMembershipRole.OWNER ||
        role === SchoolMembershipRole.ADMIN,
    );
    const isHrManager =
      authorization.roles.includes(SchoolMembershipRole.HR_MANAGER) &&
      !canManageStaff;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Enter the required staff details." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;

    let hireDate: Date | null = null;
    const hireDateInput = data.hireDate;
    if (hireDateInput !== undefined && hireDateInput !== null && hireDateInput !== "") {
      if (typeof hireDateInput !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(hireDateInput)) {
        return Response.json({ error: "Hire date must use YYYY-MM-DD format or be empty." }, { status: 400 });
      }
      const parsedHireDate = new Date(`${hireDateInput}T00:00:00.000Z`);
      if (Number.isNaN(parsedHireDate.getTime()) || parsedHireDate.toISOString().slice(0, 10) !== hireDateInput) {
        return Response.json({ error: "Hire date must be a valid calendar date." }, { status: 400 });
      }
      hireDate = parsedHireDate;
    }

    if (isHrManager && ("password" in data || "role" in data)) {
      return Response.json(
        { error: "HR can register employee details but cannot create login credentials or assign school roles." },
        { status: 403 },
      );
    }

    const requiredFields = isHrManager
      ? ["firstName", "lastName", "employeeNumber"]
      : ["firstName", "lastName", "employeeNumber", "email", "password", "role"];

    if (requiredFields.some((field) => !isText(data[field]))) {
      return Response.json(
        {
          error: isHrManager
            ? "First name, last name, and employee number are required."
            : "First name, last name, employee number, email, password, and role are required.",
        },
        { status: 400 },
      );
    }

    const firstName = (data.firstName as string).trim();
    const middleName = isText(data.middleName) ? data.middleName.trim() : null;
    const lastName = (data.lastName as string).trim();
    const employeeNumber = (data.employeeNumber as string).trim();
    const email = isText(data.email) ? data.email.trim().toLowerCase() : null;
    const password = data.password as string;
    const role = data.role as string;
    const phone = isText(data.phone) ? data.phone.trim() : null;
    const jobTitle = isText(data.jobTitle) ? data.jobTitle.trim() : null;
    const department = isText(data.department) ? data.department.trim() : null;
    const name = [firstName, middleName, lastName].filter(Boolean).join(" ");

    if (
      firstName.length > 80 ||
      lastName.length > 80 ||
      (middleName && middleName.length > 80) ||
      name.length < 2 ||
      name.length > 100
    ) {
      return Response.json({ error: "Names must be valid and no longer than 80 characters each." }, { status: 400 });
    }

    if (employeeNumber.length > 50) {
      return Response.json({ error: "Employee number must not exceed 50 characters." }, { status: 400 });
    }

    if (
      email &&
      (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (!isHrManager && (password.length < 8 || password.length > 128)) {
      return Response.json({ error: "Password must contain 8 to 128 characters." }, { status: 400 });
    }

    if (!isHrManager && !assignableRoles.some((item) => item === role)) {
      return Response.json({ error: "Select a permitted staff role." }, { status: 400 });
    }

    for (const [label, value] of [
      ["Phone", phone],
      ["Job title", jobTitle],
      ["Department", department],
    ] as const) {
      if (value && value.length > 100) {
        return Response.json({ error: `${label} must not exceed 100 characters.` }, { status: 400 });
      }
    }

    if (!isHrManager && email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        return Response.json(
          { error: "An account with this email already exists. Existing-account linking is not supported in this workflow." },
          { status: 409 },
        );
      }
    }

    const existingEmployee = await prisma.staffProfile.findUnique({
      where: {
        schoolId_employeeNumber: { schoolId, employeeNumber },
      },
      select: { id: true },
    });

    if (existingEmployee) {
      return Response.json(
        { error: "This employee number is already in use at this school." },
        { status: 409 },
      );
    }

    if (isHrManager) {
      const staff = await prisma.$transaction(async (tx) => {
        const createdStaff = await tx.staffProfile.create({
          data: {
            schoolId,
            userId: null,
            employeeNumber,
            firstName,
            middleName,
            lastName,
            email,
            phone,
            jobTitle,
            department,
            hireDate,
          },
        });

        await tx.staffEmploymentHistory.create({
          data: {
            schoolId,
            staffProfileId: createdStaff.id,
            changeType: EmploymentChangeType.HIRED,
            effectiveDate: hireDate ?? new Date(),
            newJobTitle: createdStaff.jobTitle,
            newDepartment: createdStaff.department,
            description: "Initial employee record created.",
          },
        });

        await createAuditLog(
          tx,
          {
            actorId: authorization.userId,
            schoolId,
            action: "SCHOOL_STAFF_CREATED",
            resourceType: "StaffProfile",
            resourceId: createdStaff.id,
            metadata: {
              employeeNumber,
              name,
              email,
              operation: "EMPLOYEE_PROFILE_ONLY",
            },
          },
          request,
        );

        return createdStaff;
      });

      return Response.json(
        {
          staff: {
            id: staff.id,
            employeeNumber: staff.employeeNumber,
            firstName: staff.firstName,
            middleName: staff.middleName,
            lastName: staff.lastName,
            email: staff.email,
            phone: staff.phone,
            jobTitle: staff.jobTitle,
            department: staff.department,
            status: staff.status,
          },
        },
        { status: 201 },
      );
    }

    if (!email) {
      return Response.json({ error: "A valid login email is required." }, { status: 400 });
    }

    const result = await auth.api.createUser({
      body: { name, email, password },
    });

    if (!result?.user) {
      return Response.json({ error: "Failed to create the staff login account." }, { status: 500 });
    }

    createdUserId = result.user.id;
    const selectedRole = role as (typeof assignableRoles)[number];

    const created = await prisma.$transaction(async (tx) => {
      const staff = await tx.staffProfile.create({
        data: {
          schoolId,
          userId: result.user.id,
          employeeNumber,
          firstName,
          middleName,
          lastName,
          email,
          phone,
          jobTitle,
          department,
          hireDate,
        },
      });

      await tx.staffEmploymentHistory.create({
        data: {
          schoolId,
          staffProfileId: staff.id,
          changeType: EmploymentChangeType.HIRED,
          effectiveDate: hireDate ?? new Date(),
          newJobTitle: staff.jobTitle,
          newDepartment: staff.department,
          description: "Initial employee record created.",
        },
      });

      const membership = await tx.schoolMembership.create({
        data: {
          userId: result.user.id,
          schoolId,
          role: selectedRole,
          isActive: true,
        },
      });

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SCHOOL_STAFF_CREATED",
          resourceType: "StaffProfile",
          resourceId: staff.id,
          metadata: {
            employeeNumber,
            name,
            email,
            role: selectedRole,
          },
        },
        request,
      );

      await createAuditLog(
        tx,
        {
          actorId: authorization.userId,
          schoolId,
          action: "SCHOOL_MEMBER_ROLE_ASSIGNED",
          resourceType: "SchoolMembership",
          resourceId: membership.id,
          metadata: {
            userId: result.user.id,
            userEmail: email,
            role: selectedRole,
            operation: "CREATED_WITH_STAFF_PROFILE",
          },
        },
        request,
      );

      return { staff, membership };
    });

    return Response.json(
      {
        staff: {
          id: created.staff.id,
          employeeNumber: created.staff.employeeNumber,
          firstName: created.staff.firstName,
          middleName: created.staff.middleName,
          lastName: created.staff.lastName,
          email: created.staff.email,
          phone: created.staff.phone,
          jobTitle: created.staff.jobTitle,
          department: created.staff.department,
          status: created.staff.status,
        },
        membership: {
          id: created.membership.id,
          role: created.membership.role,
          isActive: created.membership.isActive,
        },
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (createdUserId) {
      try {
        await prisma.user.delete({ where: { id: createdUserId } });
      } catch (cleanupError) {
        console.error("Failed to clean up account after staff creation failure:", cleanupError);
      }
    }

    const response = authorizationErrorResponse(error);
    if (response) return response;

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        { error: "The email, employee number, or staff account conflicts with an existing record." },
        { status: 409 },
      );
    }

    console.error("Failed to create school staff:", error);
    return Response.json(
      { error: "Unable to create the staff member. Check the submitted details and try again." },
      { status: 500 },
    );
  }
}
