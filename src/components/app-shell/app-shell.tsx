import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

type AppShellProps = {
  children: ReactNode;
  user: {
    name: string;
    email: string;
    schoolRole: string;
    schoolId?: string;
    academicYearName?: string | null;
    schoolName?: string;
  };
};

export function AppShell({ children, user }: AppShellProps) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar schoolName={user.schoolName} academicYearName={user.academicYearName} schoolRole={user.schoolRole} />

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <Topbar user={user} />

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </main>
      </div>
    </div>
  );
}
