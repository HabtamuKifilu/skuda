import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell/app-shell";
import { SchoolAdminForm } from "@/components/school-admin/school-admin-form";
import { SchoolMembersManager } from "@/components/school-admin/school-members-manager";
import { StaffProfileForm } from "@/components/school-admin/staff-profile-form";
import { resolveWorkspace } from "@/lib/workspace";
import { enforceRegistrarTaskOnlyAccess } from "@/lib/page-authorization";
import { redirect } from "next/navigation";

export default async function AdministrationPage() {
  const workspace = await resolveWorkspace();
  enforceRegistrarTaskOnlyAccess(workspace);

  if (workspace.type !== "SCHOOL") redirect("/");
  const isHrManager = workspace.schoolRole === "HR_MANAGER";
  const canManageMembership =
    workspace.schoolRole === "OWNER" || workspace.schoolRole === "ADMIN";

  if (!canManageMembership && !isHrManager) redirect("/");

  const isOwner = workspace.schoolRole === "OWNER";

  return (
    <AppShell user={{
      name: workspace.userName,
      email: workspace.userEmail,
      schoolRole: workspace.schoolRole,
schoolId: workspace.schoolId,
      schoolName: workspace.schoolName,
      academicYearName: workspace.academicYearName,
    }}>
      <div className="w-full space-y-6 px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8">
        <section>
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">School administration</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Administration</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {isHrManager
                  ? "Register and maintain employee records. Login credentials and school roles are managed separately."
                  : "Manage school membership and staff access. Role assignments are scoped to this school."}
              </p>
            </div>
          </div>
        </section>

        {canManageMembership ? (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Users className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Membership management</h2>
                <p className="mt-1 text-sm text-muted-foreground">Review current role assignments and assign supported staff roles.</p>
              </div>
            </div>
            <SchoolMembersManager schoolId={workspace.schoolId} />
          </section>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <UserPlus className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">{isHrManager ? "Register employee" : "Create staff member"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isHrManager
                    ? "Record employee details without creating login credentials or assigning a school role."
                    : "Register an employee, create their login, and assign their initial school role."}
                </p>
              </div>
            </div>
          </div>
          <StaffProfileForm schoolId={workspace.schoolId} employeeOnly={isHrManager} />
        </section>

        {isOwner ? (
          <>
            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <UserPlus className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Create school administrator</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Create an administrator account with permissions scoped to this school.</p>
                  </div>
                </div>
              </div>
              <SchoolAdminForm schoolId={workspace.schoolId} />
            </section>

            <section className="rounded-xl border border-border bg-muted/30 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                <div>
                  <h2 className="text-sm font-semibold">Access and accountability</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Only the school owner can create an administrator through this page. The administrator receives the ADMIN role in this school only. The action is recorded in the school audit log.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
