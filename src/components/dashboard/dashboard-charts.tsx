"use client";

import {
Area,
AreaChart,
Bar,
BarChart,
CartesianGrid,
ResponsiveContainer,
Tooltip,
XAxis,
YAxis,
} from "recharts";

type EnrollmentTrendPoint = {
month: string;
enrollments: number;
};

type GradeDistributionPoint = {
grade: string;
students: number;
};

type DashboardChartsProps = {
enrollmentTrend: EnrollmentTrendPoint[];
gradeDistribution: GradeDistributionPoint[];
};

function EmptyChart({ message }: { message: string }) {
return ( <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 text-center"> <div> <p className="text-sm font-medium">Not enough data yet</p> <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
{message} </p> </div> </div>
);
}

const tooltipStyle = {
background: "var(--card)",
border: "1px solid var(--border)",
borderRadius: 10,
fontSize: 12,
};

const axisTick = {
fill: "var(--muted-foreground)",
fontSize: 11,
};

export function DashboardCharts({
enrollmentTrend,
gradeDistribution,
}: DashboardChartsProps) {
return ( <div className="grid min-w-0 gap-5 xl:grid-cols-[1.55fr_1fr]"> <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-6"> <div className="mb-5 flex flex-wrap items-start justify-between gap-3"> <div> <h2 className="text-sm font-semibold">Enrollment trend</h2> <p className="mt-1 text-xs text-muted-foreground">
Student enrollments by month in the current academic year </p> </div> </div>

    {enrollmentTrend.some((point) => point.enrollments > 0) ? (
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={enrollmentTrend}
            margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
          >
            <defs>
              <linearGradient id="enrollmentFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--primary)"
                  stopOpacity={0.2}
                />
                <stop
                  offset="95%"
                  stopColor="var(--primary)"
                  stopOpacity={0.01}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              tickMargin={10}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              width={38}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{
                color: "var(--foreground)",
                fontWeight: 600,
              }}
              formatter={(value) => [value, "Enrollments"]}
            />
            <Area
              type="monotone"
              dataKey="enrollments"
              name="Enrollments"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#enrollmentFill)"
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <EmptyChart message="Enrollment activity will appear here as students are enrolled during the academic year." />
    )}
  </section>

  <section className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-6">
    <div className="mb-5">
      <h2 className="text-sm font-semibold">Students by grade</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Active enrollments grouped by grade
      </p>
    </div>

    {gradeDistribution.length > 0 ? (
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={gradeDistribution}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
          >
            <CartesianGrid
              horizontal={false}
              stroke="var(--border)"
              strokeDasharray="3 3"
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
            />
            <YAxis
              type="category"
              dataKey="grade"
              width={68}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{
                color: "var(--foreground)",
                fontWeight: 600,
              }}
              formatter={(value) => [value, "Active students"]}
              cursor={{ fill: "var(--muted)" }}
            />
            <Bar
              dataKey="students"
              name="Active students"
              fill="var(--primary)"
              radius={[0, 5, 5, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <EmptyChart message="Grade distribution will appear after students are enrolled in the current academic year." />
    )}
  </section>
</div>

);
}
