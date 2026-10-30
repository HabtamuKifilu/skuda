"use client";

import {
  Building2,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type UserMenuProps = {
  name: string;
  email?: string;
  initials: string;
  subtitle: string;
};

export function UserMenu({
  name,
  email,
  initials,
  subtitle,
}: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="ml-2 flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </span>

        <span className="hidden text-left sm:block">
          <span className="block max-w-44 truncate text-sm font-medium leading-4">
            {name}
          </span>
          <span className="block max-w-44 truncate text-[11px] text-muted-foreground">
            {subtitle}
          </span>
        </span>

        <span
          className={`hidden px-1 text-xs text-muted-foreground transition-transform sm:block ${
            open ? "rotate-180" : ""
          }`}
        >
          ⌄
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close user menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
          >
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </span>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  {email ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {email}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-1.5">
              <a
                href="/api/workspace/switch-school"
                role="menuitem"
                className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-muted"
              >
                <Building2 className="size-4" />
                Switch school
              </a>

              <button
                type="button"
                role="menuitem"
                disabled
                className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground opacity-60"
              >
                <UserRound className="size-4" />
                Profile
                <span className="ml-auto text-[10px]">Soon</span>
              </button>

              <button
                type="button"
                role="menuitem"
                disabled
                className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground opacity-60"
              >
                <Settings className="size-4" />
                Settings
                <span className="ml-auto text-[10px]">Soon</span>
              </button>

              <div className="my-1.5 h-px bg-border" />

              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-60"
              >
                <LogOut className="size-4" />
                {isSigningOut ? "Signing out..." : "Log out"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
