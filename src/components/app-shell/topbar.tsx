"use client";

import { Menu, Search } from "lucide-react";
import { NotificationCenter } from "./notification-center";
import { UserMenu } from "@/components/auth/user-menu";

type TopbarProps = {
  user: {
    name: string;
    email: string;
    schoolRole: string;
    schoolId?: string;
  };
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatRole(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Topbar({ user }: TopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>

        <button
          type="button"
          className="hidden h-9 w-72 items-center gap-2 rounded-lg border border-input bg-muted/30 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 md:flex"
        >
          <Search className="size-4" />
          <span>Search anything...</span>
          <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">
            /
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {user.schoolId ? <NotificationCenter schoolId={user.schoolId} /> : null}

        <div className="ml-2 h-7 w-px bg-border" />

        <UserMenu
          name={user.name}
          email={user.email}
          initials={getInitials(user.name)}
          subtitle={formatRole(user.schoolRole)}
        />
      </div>
    </header>
  );
}
