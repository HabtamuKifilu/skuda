"use client";

import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  CreditCard,
  FileClock,
  Flag,
  Gauge,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  WalletCards,
  Webhook,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type SidebarItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  available?: boolean;
};

type SidebarSection = {
  label: string;
  items: SidebarItem[];
};

const sections: SidebarSection[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Overview",
        href: "/platform",
        icon: LayoutDashboard,
        available: true,
      },
    ],
  },
  {
    label: "Organization",
    items: [
      {
        label: "Schools",
        href: "/platform/schools",
        icon: Building2,
        available: true,
      },
      {
        label: "School Owners",
        href: "/platform/school-owners",
        icon: ShieldCheck,
        available: true,
      },
      {
        label: "Users",
        href: "/platform/users",
        icon: Users,
        available: true,
      },
    ],
  },
  {
    label: "Commercial",
    items: [
      {
        label: "Subscriptions",
        href: "/platform/subscriptions",
        available: true,
        icon: WalletCards,
      },
      {
        label: "Plans",
        available: true,
        href: "/platform/plans",
        icon: Receipt,
      },
      {
        label: "Billing",
      available: true,
        href: "/platform/billing",
        icon: CreditCard,
      },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        label: "Feature Flags",
        available: true,
        href: "/platform/feature-flags",
        icon: Flag,
      },
      {
        label: "Integrations",
        available: true,
        href: "/platform/integrations",
        icon: Webhook,
      },
      {
        label: "Notifications",
        available: true,
        href: "/platform/notifications",
        icon: Bell,
      },
    ],
  },
  {
    label: "Governance",
    items: [
      {
        label: "Audit Logs",
        available: true,
        href: "/platform/audit-logs",
        icon: FileClock,
      },
      {
        label: "Activity",
        available: true,
        href: "/platform/activity",
        icon: Activity,
      },
      {
        label: "Security",
        available: true,
        href: "/platform/security",
        icon: LockKeyhole,
      },
      {
        label: "Access Control",
        available: true,
        href: "/platform/access-control",
        icon: ShieldCheck,
      },
    ],
  },
  {
    label: "Support",
    items: [
      {
        label: "Support",
        available: true,
        href: "/platform/support",
        icon: Headphones,
      },
      {
        label: "Announcements",
        available: true,
        href: "/platform/announcements",
        icon: Bell,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "System Health",
        available: true,
        href: "/platform/system-health",
        icon: Gauge,
      },
      {
        label: "Developer Tools",
        available: true,
        href: "/platform/developer",
        icon: Wrench,
      },
      {
        label: "Settings",
        available: true,
        href: "/platform/settings",
        icon: Settings,
      },
    ],
  },
];

export function PlatformSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Link href="/platform" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <span className="text-sm font-bold tracking-tight">S</span>
          </span>

          <span className="text-[17px] font-semibold tracking-tight">
            SKUDA
          </span>
        </Link>
      </div>

      <div className="border-b border-sidebar-border px-4 py-4">
        <p className="px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Control plane
        </p>

        <div className="mt-2 flex items-center gap-3 rounded-lg border border-sidebar-border bg-background/60 px-2.5 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
            S
          </span>

          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              SKUDA Platform
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              Global administration
            </span>
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {section.label}
            </p>

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const available = item.available === true;
                const active =
                  available &&
                  (item.href === "/platform"
                    ? pathname === "/platform"
                    : pathname.startsWith(item.href));

                if (!available) {
                  return (
                    <div
                      key={item.href}
                      className="flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground/60"
                      title={`${item.label} is not available yet`}
                    >
                      <Icon
                        className="size-[17px]"
                        strokeWidth={1.8}
                      />

                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>

                      <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground/50">
                        Soon
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon
                      className="size-[17px]"
                      strokeWidth={1.8}
                    />

                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
