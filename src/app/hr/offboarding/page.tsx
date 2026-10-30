import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { StaffOffboardingManagement } from "@/components/hr/staff-offboarding-management";
import { resolveWorkspace } from "@/lib/workspace";
import { enforceRegistrarTaskOnlyAccess } from "@/lib/page-authorization";

export default async function HrOffboardingPage() {
  const workspace = await resolveWorkspace();
  enforceRegistrarTaskOnlyAccess(workspace);

  if (workspace.type !== "SCHOOL") redirect("/");
  if (!["OWNER", "ADMIN", "HR_MANAGER"].includes(workspace.schoolRole)) {
    redirect("/");
  }

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
      <StaffOffboardingManagement schoolId={workspace.schoolId} schoolRole={workspace.schoolRole} />
    </AppShell>
  );
}
