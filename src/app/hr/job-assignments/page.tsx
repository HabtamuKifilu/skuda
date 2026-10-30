import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { JobAssignmentManagement } from "@/components/hr/job-assignment-management";
import { resolveWorkspace } from "@/lib/workspace";
import { enforceRegistrarTaskOnlyAccess } from "@/lib/page-authorization";

export default async function HrJobAssignmentsPage() {
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
      <JobAssignmentManagement
        schoolId={workspace.schoolId}
        schoolRole={workspace.schoolRole}
        currentUserId={workspace.userId}
      />
    </AppShell>
  );
}
