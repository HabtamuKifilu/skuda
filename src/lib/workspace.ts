import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

type WorkspaceUser = {
  userId: string;
  userName: string;
  userEmail: string;
};

export type WorkspaceResolution =
  | ({
      type: "PLATFORM";
    } & WorkspaceUser)
  | ({
      type: "SCHOOL";
      schoolId: string;
      schoolName: string;
      schoolSlug: string;
      schoolRole: string;
      academicYearName: string | null;
    } & WorkspaceUser)
  | ({
      type: "SELECT_SCHOOL";
      schools: Array<{ id: string; name: string; slug: string }>;
    } & WorkspaceUser)
  | ({
      type: "NO_WORKSPACE";
    } & WorkspaceUser);

export async function resolveWorkspace(): Promise<WorkspaceResolution> {
  const requestHeaders = await headers();

  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const user = {
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
  };

  const platformMembership = await prisma.platformMembership.findFirst({
    where: {
      userId: session.user.id,
      role: "PLATFORM_OWNER",
      isActive: true,
    },
    select: { id: true },
  });

  if (platformMembership) {
    return {
      type: "PLATFORM",
      ...user,
    };
  }

  const memberships = await prisma.schoolMembership.findMany({
    where: {
      userId: session.user.id,
      isActive: true,
      school: { isActive: true },
    },
    select: {
      role: true,
      school: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      school: {
        name: "asc",
      },
    },
  });

  const schools = memberships
    .map((membership) => membership.school)
    .filter(
      (school, index, allSchools) =>
        allSchools.findIndex((item) => item.id === school.id) === index,
    );

  if (schools.length === 0) {
    return {
      type: "NO_WORKSPACE",
      ...user,
    };
  }

  const selectedSchoolId = (await cookies()).get("skuda_school_id")?.value;
  const selectedSchool =
    schools.length === 1
      ? schools[0]
      : schools.find((school) => school.id === selectedSchoolId);

  if (selectedSchool) {
    const membership = memberships.find(
      (item) => item.school.id === selectedSchool.id,
    );

    const currentAcademicYear = await prisma.academicYear.findFirst({
      where: {
        schoolId: selectedSchool.id,
        isCurrent: true,
      },
      select: {
        name: true,
      },
    });

    return {
      type: "SCHOOL",
      ...user,
      schoolId: selectedSchool.id,
      schoolName: selectedSchool.name,
      schoolSlug: selectedSchool.slug,
      schoolRole: membership?.role ?? "MEMBER",
      academicYearName: currentAcademicYear?.name ?? null,
    };
  }

  return {
    type: "SELECT_SCHOOL",
    ...user,
    schools,
  };
}
