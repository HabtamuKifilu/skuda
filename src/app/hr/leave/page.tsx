import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { StaffLeaveManagement } from "@/components/hr/staff-leave-management";
import { resolveWorkspace } from "@/lib/workspace";
import { enforceRegistrarTaskOnlyAccess } from "@/lib/page-authorization";

const ALLOWED_ROLES = [
  "OWNER",
  "ADMIN",
  "HR_MANAGER",
  "ACADEMIC_HEAD",
  "ACCOUNTANT",
  "TEACHER",
  "REGISTRAR",
];

export default async function HrLeavePage() {
  const workspace = await resolveWorkspace();
  enforceRegistrarTaskOnlyAccess(workspace);

  if (workspace.type !== "SCHOOL") redirect("/");
  if (!ALLOWED_ROLES.includes(workspace.schoolRole)) redirect("/");

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
      <StaffLeaveManagement
        schoolId={workspace.schoolId}
        schoolRole={workspace.schoolRole}
        currentUserId={workspace.userId}
      />
    </AppShell>
  );
}
