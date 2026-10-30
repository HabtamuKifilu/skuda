import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { EmployeeProfile } from "@/components/hr/employee-profile";
import { resolveWorkspace } from "@/lib/workspace";
import { enforceRegistrarTaskOnlyAccess } from "@/lib/page-authorization";

type PageProps = {
  params: Promise<{ staffId: string }>;
};

export default async function HrEmployeeProfilePage({ params }: PageProps) {
  const workspace = await resolveWorkspace();
  enforceRegistrarTaskOnlyAccess(workspace);

  if (workspace.type !== "SCHOOL") redirect("/");
  if (!["OWNER", "ADMIN", "HR_MANAGER"].includes(workspace.schoolRole)) {
    redirect("/");
  }

  const { staffId } = await params;
  if (!staffId || staffId.length > 128) notFound();

  return (
    <AppShell
      user={{
        name: workspace.userName,
        email: workspace.userEmail,
        schoolRole: workspace.schoolRole,
schoolId: workspace.schoolId,
        schoolName: workspace.schoolName,
        academicYearName: workspace.academicYearName,
      }}
    >
      <EmployeeProfile schoolId={workspace.schoolId} staffId={staffId} />
    </AppShell>
  );
}
