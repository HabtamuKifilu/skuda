import { ArrowRight, Building2, CalendarDays, CheckCircle2, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { prisma } from "@/lib/db/prisma";
import { resolveWorkspace } from "@/lib/workspace";
import { enforceRegistrarTaskOnlyAccess } from "@/lib/page-authorization";

function zonedMidnight(year: number, month: number, day: number, timeZone: string) {
const guess = Date.UTC(year, month - 1, day);
const parts = new Intl.DateTimeFormat("en-US", {
timeZone,
year: "numeric",
month: "2-digit",
day: "2-digit",
hour: "2-digit",
minute: "2-digit",
second: "2-digit",
hourCycle: "h23",
}).formatToParts(new Date(guess));
const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
const represented = Date.UTC(
Number(values.year), Number(values.month) - 1, Number(values.day),
Number(values.hour), Number(values.minute), Number(values.second),
);
return new Date(guess - (represented - guess));
}

export default async function Home() {
const workspace = await resolveWorkspace();
enforceRegistrarTaskOnlyAccess(workspace);

if (workspace.type === "PLATFORM") redirect("/platform");

if (workspace.type === "SELECT_SCHOOL") {
  return (
    <AppShell user={{ name: workspace.userName, email: workspace.userEmail, schoolRole: "Workspace" }}>
      <div className="relative isolate flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/[0.09] via-background to-background" />
        <div className="w-full max-w-3xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><GraduationCap className="size-6" /></div>
            <div><p className="text-lg font-bold tracking-tight">SKUDA</p><p className="text-xs text-muted-foreground">School operations platform</p></div>
            <div className="ml-auto hidden items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground sm:flex"><ShieldCheck className="size-3.5 text-primary" />Secure workspace access</div>
          </div>
          <section className="rounded-2xl border border-border/80 bg-card/95 p-5 shadow-xl shadow-foreground/[0.04] backdrop-blur sm:p-8">
            <div className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Workspace selection</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Where would you like to work?</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Your account has access to multiple schools. Choose a workspace to continue to its operational dashboard.</p></div>
            <form action="/api/workspace/select-school" method="post" className="space-y-5">
              <fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium">Available schools ({workspace.schools.length})</legend>
                {workspace.schools.map((school, index) => (
                  <label key={school.id} className="block cursor-pointer">
                    <input type="radio" name="schoolId" value={school.id} required defaultChecked={index === 0} className="peer sr-only" />
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 transition-all hover:border-primary/50 hover:bg-muted/40 peer-checked:border-primary peer-checked:bg-primary/[0.035] peer-checked:ring-1 peer-checked:ring-primary/30 peer-focus-visible:ring-2 peer-focus-visible:ring-primary sm:gap-4 sm:p-5">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-primary"><Building2 className="size-5" /></div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{school.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">School workspace · {school.slug}</p></div>
                      <CheckCircle2 className="size-5 shrink-0 text-primary opacity-0 transition-opacity peer-checked:opacity-100" />
                    </div>
                  </label>
                ))}
              </fieldset>
              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-muted-foreground">Your access is verified before a workspace is opened.</p><button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Open workspace <ArrowRight className="size-4" /></button></div>
            </form>
          </section>
          <p className="mt-5 text-center text-xs text-muted-foreground">One account · Multiple school workspaces · Securely separated data</p>
        </div>
      </div>
    </AppShell>
  );
}
if (workspace.type === "NO_WORKSPACE") {
  return (
    <AppShell user={{ name: workspace.userName, email: workspace.userEmail, schoolRole: "Workspace" }}>
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center px-4 py-10">
        <div className="w-full rounded-2xl border border-border bg-card p-8 text-center">
          <GraduationCap className="mx-auto size-8 text-primary" />
          <h1 className="mt-4 text-xl font-semibold">No school workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not currently have access to an active school workspace. Contact your school administrator or SKUDA support.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

const school = await prisma.school.findUnique({
where: { id: workspace.schoolId },
select: { timezone: true },
});
const timeZone = school?.timezone || "Africa/Addis_Ababa";

const currentAcademicYear = await prisma.academicYear.findFirst({
where: { schoolId: workspace.schoolId, isCurrent: true },
select: { id: true, name: true },
});

const now = new Date();
const dateParts = new Intl.DateTimeFormat("en-US", {
timeZone, year: "numeric", month: "2-digit", day: "2-digit",
}).formatToParts(now);
const dateValues = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
const year = Number(dateValues.year);
const month = Number(dateValues.month);
const day = Number(dateValues.day);
const todayStart = zonedMidnight(year, month, day, timeZone);
const tomorrowDate = new Date(Date.UTC(year, month - 1, day + 1));
const tomorrowStart = zonedMidnight(
tomorrowDate.getUTCFullYear(),
tomorrowDate.getUTCMonth() + 1,
tomorrowDate.getUTCDate(),
timeZone,
);

const [studentCount, staffCount, enrollments, attendanceCount] = await Promise.all([
prisma.studentProfile.count({
where: { schoolId: workspace.schoolId, isActive: true },
}),
prisma.staffProfile.count({
where: { schoolId: workspace.schoolId, status: "ACTIVE" },
}),
currentAcademicYear
? prisma.enrollment.findMany({
where: { academicYearId: currentAcademicYear.id, status: "ACTIVE" },
select: { enrollmentDate: true, grade: { select: { name: true } } },
})
: Promise.resolve([]),
currentAcademicYear
? prisma.studentAttendance.count({
where: {
date: { gte: todayStart, lt: tomorrowStart },
enrollment: { academicYearId: currentAcademicYear.id },
},
})
: Promise.resolve(0),
]);

const monthFormatter = new Intl.DateTimeFormat("en", {
month: "short",
timeZone,
});
const monthKeys = Array.from({ length: 6 }, (_, index) => {
const date = new Date(Date.UTC(year, month - 1 - (5 - index), 1));
return {
key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
month: monthFormatter.format(date),
};
});

const enrollmentTrend = monthKeys.map((item) => ({
month: item.month,
enrollments: enrollments.filter((enrollment) => {
const parts = new Intl.DateTimeFormat("en-US", {
timeZone, year: "numeric", month: "2-digit",
}).formatToParts(enrollment.enrollmentDate);
const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
return `${values.year}-${values.month}` === item.key;
}).length,
}));

const gradeCounts = new Map<string, number>();
for (const enrollment of enrollments) {
gradeCounts.set(enrollment.grade.name, (gradeCounts.get(enrollment.grade.name) ?? 0) + 1);
}
const gradeDistribution = [...gradeCounts.entries()]
.map(([grade, students]) => ({ grade, students }))
.sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true }));

const stats = [
{ label: "Active students", value: studentCount, detail: "Active student profiles", icon: GraduationCap },
{ label: "Teaching & school staff", value: staffCount, detail: "Active staff profiles", icon: Users },
{ label: "Attendance recorded today", value: attendanceCount, detail: "Records for the current academic year", icon: CalendarDays },
];

return (
<AppShell user={{
name: workspace.userName,
email: workspace.userEmail,
schoolRole: workspace.schoolRole,
schoolId: workspace.schoolId,
schoolName: workspace.schoolName,
academicYearName: workspace.academicYearName,
}}> <div className="w-full px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8 space-y-6"> <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"> <div> <p className="text-sm font-medium text-primary">Overview</p> <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
School dashboard </h1> <p className="mt-1.5 text-sm text-muted-foreground">
Live operational summary for {workspace.schoolName}. </p> </div> <div className="text-right text-sm text-muted-foreground"> <p>{currentAcademicYear?.name ?? "No academic year configured"}</p> <p>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone }).format(now)}</p> </div> </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-[18px]" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight">{stat.value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
          </div>
        );
      })}
    </section>

    {!currentAcademicYear && (
      <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
        Create and set a current academic year to populate enrollment, grade distribution, and attendance analytics.
      </div>
    )}

    <DashboardCharts
      enrollmentTrend={enrollmentTrend}
      gradeDistribution={gradeDistribution}
    />
  </div>
</AppShell>

);
}
