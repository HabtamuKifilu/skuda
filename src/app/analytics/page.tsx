import { BarChart3, GraduationCap, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { prisma } from "@/lib/db/prisma";
import { resolveWorkspace } from "@/lib/workspace";
import { enforceRegistrarTaskOnlyAccess } from "@/lib/page-authorization";

export default async function AnalyticsPage() {
const workspace = await resolveWorkspace();
enforceRegistrarTaskOnlyAccess(workspace);

if (workspace.type === "PLATFORM") {
redirect("/platform");
}

if (
workspace.type === "NO_WORKSPACE" ||
workspace.type === "SELECT_SCHOOL"
) {
return (
<AppShell
user={{
name: workspace.userName,
email: workspace.userEmail,
schoolRole: "Workspace",
}}
> <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center px-4 py-10"> <div className="w-full rounded-2xl border border-border bg-card p-8 text-center"> <BarChart3 className="mx-auto size-8 text-primary" /> <h1 className="mt-4 text-xl font-semibold">
{workspace.type === "SELECT_SCHOOL"
? "Choose a school workspace"
: "No school workspace"} </h1> <p className="mt-2 text-sm text-muted-foreground">
{workspace.type === "SELECT_SCHOOL"
? "Select a school workspace to view its analytics."
: "Your account does not currently have access to an active school workspace."} </p> </div> </div> </AppShell>
);
}

const school = await prisma.school.findUnique({
where: { id: workspace.schoolId },
select: { timezone: true },
});
const timeZone = school?.timezone || "Africa/Addis_Ababa";
const now = new Date();

const dateParts = new Intl.DateTimeFormat("en-US", {
timeZone,
year: "numeric",
month: "2-digit",
}).formatToParts(now);
const dateValues = Object.fromEntries(
dateParts.map((part) => [part.type, part.value]),
);
const year = Number(dateValues.year);
const month = Number(dateValues.month);

const currentAcademicYear = await prisma.academicYear.findFirst({
where: {
schoolId: workspace.schoolId,
isCurrent: true,
},
select: {
id: true,
name: true,
startDate: true,
endDate: true,
},
});

const [activeStudentCount, activeGradeCount, enrollments] =
await Promise.all([
prisma.studentProfile.count({
where: {
schoolId: workspace.schoolId,
isActive: true,
},
}),
prisma.grade.count({
where: {
schoolId: workspace.schoolId,
isActive: true,
},
}),
currentAcademicYear
? prisma.enrollment.findMany({
where: {
academicYearId: currentAcademicYear.id,
status: "ACTIVE",
},
select: {
enrollmentDate: true,
grade: { select: { name: true } },
},
})
: Promise.resolve([]),
]);

const monthFormatter = new Intl.DateTimeFormat("en", {
month: "short",
timeZone,
});

const monthKeys = Array.from({ length: 6 }, (_, index) => {
const date = new Date(
Date.UTC(year, month - 1 - (5 - index), 1),
);

return {
  key: `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}`,
  month: monthFormatter.format(date),
};

});

const enrollmentTrend = monthKeys.map((item) => ({
month: item.month,
enrollments: enrollments.filter((enrollment) => {
const parts = new Intl.DateTimeFormat("en-US", {
timeZone,
year: "numeric",
month: "2-digit",
}).formatToParts(enrollment.enrollmentDate);
const values = Object.fromEntries(
parts.map((part) => [part.type, part.value]),
);

  return `${values.year}-${values.month}` === item.key;
}).length,

}));

const gradeCounts = new Map<string, number>();

for (const enrollment of enrollments) {
gradeCounts.set(
enrollment.grade.name,
(gradeCounts.get(enrollment.grade.name) ?? 0) + 1,
);
}

const gradeDistribution = [...gradeCounts.entries()]
.map(([grade, students]) => ({ grade, students }))
.sort((a, b) =>
a.grade.localeCompare(b.grade, undefined, { numeric: true }),
);

const stats = [
{
label: "Active student profiles",
value: activeStudentCount,
detail: "Active students registered at this school",
icon: GraduationCap,
},
{
label: "Current-year enrollments",
value: enrollments.length,
detail: currentAcademicYear?.name ?? "No current academic year",
icon: Users,
},
{
label: "Active grades",
value: activeGradeCount,
detail: "Grades configured for this school",
icon: BarChart3,
},
];

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
> <div className="w-full px-5 py-5 font-sans text-[13px] sm:px-6 lg:px-7 xl:px-8 space-y-6"> <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"> <div> <p className="text-sm font-medium text-primary">School insights</p> <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
Analytics </h1> <p className="mt-1.5 text-sm text-muted-foreground">
Enrollment activity and student distribution for{" "}
{workspace.schoolName}. </p> </div> <div className="text-sm text-muted-foreground sm:text-right"> <p>{currentAcademicYear?.name ?? "No academic year configured"}</p> <p>
Updated{" "}
{new Intl.DateTimeFormat("en", {
dateStyle: "medium",
timeZone,
}).format(now)} </p> </div> </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-[18px]" />
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight">
              {stat.value.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {stat.detail}
            </p>
          </div>
        );
      })}
    </section>

    {!currentAcademicYear && (
      <div className="rounded-xl border border-dashed border-border bg-card p-4">
        <p className="text-sm font-medium">Academic year required</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Set a current academic year and enroll students to populate
          enrollment and grade analytics.
        </p>
      </div>
    )}

    <section className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight">
        Enrollment and grade distribution
      </h2>
      <p className="text-sm text-muted-foreground">
        Charts are calculated from this school&apos;s current-year active
        enrollments.
      </p>
    </section>

    <DashboardCharts
      enrollmentTrend={enrollmentTrend}
      gradeDistribution={gradeDistribution}
    />
  </div>
</AppShell>

);
}
