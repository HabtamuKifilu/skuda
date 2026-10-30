import { headers } from "next/headers";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { PlatformSidebar } from "./sidebar";
import { PlatformTopbar } from "./topbar";

export async function PlatformShell({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const user = session?.user;

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-background text-foreground">
      <PlatformSidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PlatformTopbar
          user={{
            name: user?.name ?? "Platform Owner",
            email: user?.email ?? "",
          }}
        />

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
