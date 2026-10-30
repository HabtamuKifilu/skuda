import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { StudyShiftManagement } from "@/components/academics/study-shift-management";
import { resolveWorkspace } from "@/lib/workspace";
import { enforceRegistrarTaskOnlyAccess } from "@/lib/page-authorization";

const managementRoles = ["OWNER", "ADMIN", "ACADEMIC_HEAD"];

export default async function StudyShiftsPage() {
  const workspace = await resolveWorkspace();
  enforceRegistrarTaskOnlyAccess(workspace);

  if (workspace.type !== "SCHOOL") redirect("/");
  if (!managementRoles.includes(workspace.schoolRole)) redirect("/");

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
      <StudyShiftManagement schoolId={workspace.schoolId} />
    </AppShell>
  );
}
