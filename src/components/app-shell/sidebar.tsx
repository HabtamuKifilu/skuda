"use client";

import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  CalendarDays,
  ClipboardList,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Settings,
  TrendingUp,
  Users,
  WalletCards,
  FileText,
  UserPlus,
  BriefcaseBusiness,
  ShieldCheck,
  History,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavigationItem = {
  label: string;
  href?: string;
  icon: typeof LayoutDashboard;
  group?: string;
  status?: "Build" | "Planned" | "Restricted";
};

type SidebarProps = {
  schoolName?: string;
  academicYearName?: string | null;
  schoolRole: string;
};

function getSchoolMark(schoolName?: string) {
  if (!schoolName?.trim()) {
    return "S";
  }

  const words = schoolName.trim().split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function Sidebar({ schoolName, academicYearName, schoolRole }: SidebarProps) {
  const isOwner = schoolRole === "OWNER";
  const isAdmin = schoolRole === "ADMIN";
  const isAcademicHead = schoolRole === "ACADEMIC_HEAD";
  const isHrManager = schoolRole === "HR_MANAGER";
  const isRegistrar = schoolRole === "REGISTRAR";

  const hrNavigation: NavigationItem[] = [
    { label: "Overview", icon: LayoutDashboard, group: "WORKSPACE", status: "Build" },

    { label: "Employees", href: "/hr/employees", icon: Users, group: "PEOPLE" },
    { label: "Recruitment", href: "/hr/recruitment", icon: UserPlus, group: "PEOPLE" },
    { label: "Jobs", href: "/hr/jobs", icon: BriefcaseBusiness, group: "PEOPLE" },
    { label: "Onboarding", href: "/hr/onboarding", icon: UserPlus, group: "PEOPLE" },

    { label: "Job assignments", href: "/hr/job-assignments", icon: BriefcaseBusiness, group: "EMPLOYMENT" },
    { label: "Contracts", href: "/hr/contracts", icon: FileText, group: "EMPLOYMENT" },
    { label: "Promotions", href: "/hr/promotions", icon: TrendingUp, group: "EMPLOYMENT" },
    { label: "Transfers", href: "/hr/transfers", icon: Layers, group: "EMPLOYMENT" },
    { label: "Offboarding", href: "/hr/offboarding", icon: LogOut, group: "EMPLOYMENT" },

    { label: "Attendance", href: "/hr/attendance", icon: ClipboardCheck, group: "TIME & DEVELOPMENT" },
    { label: "Leave", href: "/hr/leave", icon: CalendarDays },
    { label: "Qualifications & training", href: "/hr/qualifications", icon: GraduationCap },
    { label: "Performance", href: "/hr/performance", icon: TrendingUp },
    { label: "Development", href: "/hr/development", icon: GraduationCap },

    { label: "Reports", href: "/hr/reports", icon: BarChart3, group: "INSIGHTS & CONTROL" },
    { label: "Audit", icon: History, status: "Planned" },
    { label: "Access", icon: ShieldCheck, group: "ACCESS CONTROL", status: "Restricted" },

    { label: "Careers page", href: "/hr/careers", icon: BriefcaseBusiness, group: "CAREERS" },
  ];

  const registrarNavigation: NavigationItem[] = [
    { label: "Overview", href: "/", icon: LayoutDashboard, group: "WORKSPACE" },

    { label: "Admissions", icon: UserPlus, group: "ADMISSIONS", status: "Planned" },

    { label: "Students", icon: GraduationCap, group: "STUDENT RECORDS", status: "Planned" },
    { label: "Guardians", icon: Users, status: "Planned" },

    { label: "Enrollments", icon: Layers, group: "ENROLLMENT", status: "Planned" },
    { label: "Academic-Year Rollover", icon: CalendarDays, status: "Planned" },

    { label: "Transfers & Withdrawals", icon: LogOut, group: "STUDENT MOVEMENTS", status: "Planned" },

    { label: "Documents", icon: FileText, group: "RECORDS & DOCUMENTS", status: "Planned" },
    { label: "Student Certificates", icon: FileText, status: "Planned" },

    { label: "Attendance Records", icon: ClipboardCheck, group: "SCHOOL OPERATIONS", status: "Planned" },
    { label: "Communication", icon: MessageSquare, group: "COMMUNICATION", status: "Planned" },

    { label: "Reports & Audit", icon: History, group: "INSIGHTS & CONTROL", status: "Planned" },
  ];

  const navigation: NavigationItem[] = isHrManager ? hrNavigation : isRegistrar ? registrarNavigation : isAcademicHead ? [
    { label: "Overview", href: "/", icon: LayoutDashboard, group: "WORKSPACE" },

    { label: "Students", icon: GraduationCap, group: "STUDENTS & ADMISSIONS" },

    { label: "Academics", href: "/academics", icon: BookOpen, group: "ACADEMICS" },
    { label: "Grades", href: "/academics/grades", icon: GraduationCap },
    { label: "Sections", href: "/academics/sections", icon: Layers },
    { label: "Study shifts", href: "/academics/shifts", icon: Clock3 },
    { label: "Subjects", href: "/academics/subjects", icon: BookOpen },
    { label: "Subject offerings", href: "/academics/subject-offerings", icon: Layers },
    { label: "Timetable", icon: CalendarDays },
    { label: "Assessments", icon: ClipboardList },

    { label: "Attendance", icon: ClipboardCheck, group: "SCHOOL OPERATIONS" },
    { label: "Staff", icon: Users },

    { label: "Analytics", href: "/analytics", icon: BarChart3, group: "INSIGHTS & REPORTS" },
    { label: "Reports", icon: FileText },

    { label: "Communication", icon: MessageSquare, group: "COMMUNICATION" },
  ] : isAdmin ? [
    { label: "Overview", href: "/", icon: LayoutDashboard, group: "WORKSPACE" },

    { label: "Admissions", icon: Users, group: "STUDENTS & ADMISSIONS" },
    { label: "Students", icon: Users },
    { label: "Guardians", icon: Users },

    { label: "Academics", href: "/academics", icon: BookOpen, group: "ACADEMICS" },
    { label: "Grades", href: "/academics/grades", icon: GraduationCap },
    { label: "Sections", href: "/academics/sections", icon: Layers },
    { label: "Study shifts", href: "/academics/shifts", icon: Clock3 },
    { label: "Subjects", href: "/academics/subjects", icon: BookOpen },
    { label: "Subject offerings", href: "/academics/subject-offerings", icon: Layers },

    { label: "Staff", icon: Users, group: "SCHOOL OPERATIONS" },
    { label: "Attendance", icon: ClipboardCheck },

    { label: "Finance", icon: WalletCards, group: "FINANCE & INSIGHTS" },
    { label: "Analytics", href: "/analytics", icon: TrendingUp },
    { label: "Reports", icon: BarChart3 },

    { label: "Communication", icon: MessageSquare, group: "COMMUNICATION" },

    { label: "Administration", href: "/administration", icon: Settings, group: "ADMINISTRATION" },
    { label: "Audit Log", icon: Settings },

    ...hrNavigation.filter((item) => item.href),
  ] : [
    { label: "Overview", href: "/", icon: LayoutDashboard, group: "WORKSPACE" },

    { label: "People", icon: Users, group: "PEOPLE" },

    ...(isOwner
      ? [{ label: "Academics", href: "/academics", icon: BookOpen, group: "ACADEMICS" }]
      : [{ label: "Academics", icon: BookOpen, group: "ACADEMICS" }]),
    ...(isOwner ? [{ label: "Grades", href: "/academics/grades", icon: GraduationCap }] : []),
    ...(isOwner ? [{ label: "Sections", href: "/academics/sections", icon: Layers }] : []),
    ...(isOwner ? [{ label: "Study shifts", href: "/academics/shifts", icon: Clock3 }] : []),
    ...(isOwner ? [{ label: "Subjects", href: "/academics/subjects", icon: BookOpen }] : []),
    ...(isOwner ? [{ label: "Subject offerings", href: "/academics/subject-offerings", icon: Layers }] : []),

    { label: "Attendance", icon: ClipboardCheck, group: "SCHOOL OPERATIONS" },

    { label: "Finance", icon: WalletCards, group: "FINANCE & INSIGHTS" },
    { label: "Analytics", href: "/analytics", icon: TrendingUp },
    { label: "Reports", icon: BarChart3 },

    { label: "Communication", icon: MessageSquare, group: "COMMUNICATION" },

    ...(isOwner
      ? [{ label: "Administration", href: "/administration", icon: Settings, group: "ADMINISTRATION" }]
      : [{ label: "Administration", icon: Settings, group: "ADMINISTRATION" }]),
    ...(isOwner ? [{ label: "Settings", icon: Settings }] : []),

    ...(isOwner ? hrNavigation.filter((item) => item.href) : []),
  ];
  const pathname = usePathname();
  const schoolMark = getSchoolMark(schoolName);

  return (
    <aside className="sticky top-0 hidden h-dvh max-h-dvh w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Link href="/" className="flex items-center gap-2.5">
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
          Workspace
        </p>

        <Link href="/api/workspace/switch-school" className="mt-2 flex w-full items-center gap-3 rounded-lg border border-sidebar-border bg-background/60 px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
            {schoolMark}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {schoolName ?? "School Workspace"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {academicYearName ?? "No academic year"}
            </span>
          </span>

          <span className="text-muted-foreground">⌄</span>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4">
        <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {isHrManager ? "People & HR" : isRegistrar ? "Student administration" : "School operations"}
        </p>

        {navigation.map((item, index) => {
          const Icon = item.icon;
          const active = item.href
            ? item.href === "/" || item.href === "/academics"
              ? pathname === item.href
              : pathname.startsWith(item.href)
            : false;
          const itemClass = cn(
            "group flex items-center gap-3 rounded-xl px-3 text-sm transition-all duration-200",
            isHrManager || isRegistrar ? "min-h-10 h-auto py-2" : "h-10",
            active
              ? "bg-primary/10 font-semibold text-primary shadow-sm ring-1 ring-primary/15"
              : item.status === "Restricted"
                ? "cursor-not-allowed text-muted-foreground/70"
                : item.href
                  ? "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  : "cursor-not-allowed text-muted-foreground/80",
          );

          return (
            <div key={`${item.href ?? item.label}-${index}`}>
              {
                item.group &&
                item.group !== navigation
                  .slice(0, index)
                  .reverse()
                  .find((entry) => entry.group)?.group ? (
                <p className={cn(
                  "px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/75",
                  item.group === "WORKSPACE" ? "pt-1" : "pt-5",
                )}>
                  {item.group}
                </p>
              ) : null}
              {item.href ? (
                <Link href={item.href} aria-current={active ? "page" : undefined} className={itemClass}>
                  <Icon className="size-[17px] shrink-0" strokeWidth={active ? 2.1 : 1.8} />
                  <span className={cn("min-w-0 flex-1", isHrManager ? "whitespace-normal leading-tight" : "truncate")}>{item.label}</span>
                </Link>
              ) : (
                <div
                  aria-disabled="true"
                  title={item.status === "Restricted"
                    ? "Login accounts and school roles are managed by authorized administrators."
                    : isHrManager
                      ? "This HR operation will be enabled when its page is implemented."
                      : isRegistrar
                        ? "This student-administration feature is planned and will be enabled when implemented."
                        : "This school operation will be enabled when its page is implemented."}
                  className={itemClass}
                >
                  <Icon className="size-[17px] shrink-0" strokeWidth={1.8} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className={cn(
                    "shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                    item.status === "Restricted"
                      ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : item.status === "Build"
                        ? "border-primary/20 bg-primary/8 text-primary"
                        : "border-sidebar-border bg-muted/60 text-muted-foreground",
                  )}>
                    {item.status ?? "Planned"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      
    </aside>
  );
}
