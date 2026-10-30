"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EChartsReact from "echarts-for-react";
import type { EChartsOption } from "echarts";

type CountMap = Record<string, number>;

type ReportData = {
  generatedAt: string;
  filters: { from: string; to: string; department: string | null };
  months: string[];
  workforce: {
    total: number;
    byStatus: CountMap;
    byDepartment: { name: string; value: number }[];
  };
  movement: {
    hires: number;
    confirmedExits: number;
    hiresByMonth: CountMap;
    exitsByMonth: CountMap;
  };
  attendance: {
    totalRecords: number;
    byStatus: CountMap;
    daily: { date: string; [key: string]: string | number }[];
    lateCount: number;
    averageLateMinutes: number | null;
  };
  leave: {
    total: number;
    byType: CountMap;
    byStatus: CountMap;
    byMonth: CountMap;
  };
  recruitment: {
    openings: number;
    openingsByStatus: CountMap;
    applications: number;
    applicationsByStage: CountMap;
    applicationsByMonth: CountMap;
  };
  learning: {
    trainingTotal: number;
    trainingByStatus: CountMap;
    completedTraining: number;
    trainingCompletionsByMonth: CountMap;
    developmentPlans: number;
    plansByStatus: CountMap;
    developmentGoals: number;
    averageDevelopmentProgress: number | null;
  };
  performance: {
    reviewCycles: number;
    cyclesByStatus: CountMap;
    reviews: number;
    reviewsByStatus: CountMap;
    averageRating: number | null;
    ratingDistribution: { rating: number; count: number }[];
    goals: number;
    goalsByStatus: CountMap;
    averageGoalProgress: number | null;
  };
  offboarding: {
    records: number;
    byStatus: CountMap;
    byExitType: CountMap;
    confirmedExits: number;
    tasks: number;
    requiredTasks: number;
    completedRequiredTasks: number;
    waivedTasks: number;
    requiredTaskCompletionRate: number | null;
  };
};

const panelClass =
  "min-w-0 rounded-2xl border border-border/80 bg-card p-5 shadow-sm shadow-slate-950/[0.025] transition-shadow duration-200 hover:shadow-md hover:shadow-slate-950/[0.04] sm:p-6";
const chartHeight = { height: 320, width: "100%" };
const indigo = "#6366f1";
const teal = "#0d9488";
const amber = "#d97706";
const slate = "#64748b";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

function baseOption(): EChartsOption {
  return {
    animationDuration: 550,
    animationEasing: "cubicOut",
    textStyle: { fontFamily: "inherit", color: "#64748b", fontSize: 11 },
    tooltip: {
      confine: true,
      backgroundColor: "#0f172a",
      borderWidth: 0,
      padding: [10, 13],
      textStyle: { color: "#f8fafc", fontSize: 12 },
      extraCssText: "box-shadow: 0 12px 32px rgba(15,23,42,.22); border-radius: 10px;",
    },
    grid: { top: 30, right: 24, bottom: 48, left: 44, containLabel: true },
  };
}

function Metric({
  label: title,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm shadow-slate-950/[0.025] transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-950/[0.06] sm:p-5">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500/80 via-indigo-400/40 to-transparent opacity-70 transition-opacity group-hover:opacity-100" />
      <p className="truncate text-xs font-semibold uppercase tracking-[0.09em] text-muted-foreground">{title}</p>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-[2rem]">{value}</p>
      <p className="mt-2 min-h-4 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3 sm:mb-5">
      <div className="mt-0.5 h-10 w-1 shrink-0 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-300" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-indigo-600 dark:text-indigo-400">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h3>
        <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p>
        </div>
        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400/80 ring-4 ring-indigo-500/10" />
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
        <span className="text-lg">—</span>
      </span>
      <p className="text-sm font-medium text-foreground">No data to display</p>
      <p className="max-w-xs text-xs leading-5 text-muted-foreground">{message}</p>
    </div>
  );
}

function pieOption(values: CountMap, name: string): EChartsOption {
  return {
    ...baseOption(),
    tooltip: { trigger: "item", confine: true, formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, left: "center", type: "scroll" },
    series: [{
      name,
      type: "pie",
      radius: ["46%", "70%"],
      center: ["50%", "43%"],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: "var(--background)", borderWidth: 2 },
      label: { formatter: "{b}: {c}" },
      data: Object.entries(values)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => ({ name: label(key), value })),
    }],
  };
}

export function StaffReports({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const from = dateFrom || data?.filters.from || "";
  const to = dateTo || data?.filters.to || "";

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (department) params.set("department", department);

      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/hr-reports?${params.toString()}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as ReportData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load HR reports.");
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load HR reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolId, from, to, department]);

  useEffect(() => {
    void load();
  }, [load]);

  const departments = useMemo(
    () => data?.workforce.byDepartment.map((item) => item.name).filter((name) => name !== "Unassigned") ?? [],
    [data],
  );

  const movementOption: EChartsOption = {
    ...baseOption(),
    animationDuration: 1100,
    animationEasing: "elasticOut",
    animationDelayUpdate: (index: number) => index * 5,
    color: [indigo, amber],
    tooltip: {
      trigger: "axis",
      confine: true,
      backgroundColor: "#0f172a",
      borderWidth: 0,
      padding: [13, 16],
      textStyle: { color: "#f8fafc", fontSize: 12 },
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: "rgba(99, 102, 241, 0.07)" },
      },
      extraCssText: "border-radius: 12px; box-shadow: 0 12px 32px rgba(15,23,42,.22);",
      formatter: (params) => {
        const points = Array.isArray(params) ? params : [params];
        const month = String(points[0]?.axisValueLabel ?? points[0]?.axisValue ?? "");
        const hires = Number(points.find((point) => point.seriesName === "Hires")?.value ?? 0);
        const exits = Number(points.find((point) => point.seriesName === "Confirmed exits")?.value ?? 0);
        const net = hires - exits;
        const netColor = net > 0 ? "#6ee7b7" : net < 0 ? "#fca5a5" : "#cbd5e1";
        const netLabel = net > 0 ? `+${net}` : String(net);
        return `<div style="font-weight:700;font-size:13px;margin-bottom:10px">${month}</div><div style="display:flex;justify-content:space-between;gap:24px;margin:5px 0"><span style="color:#c7d2fe">● Hires</span><strong>${hires.toLocaleString()}</strong></div><div style="display:flex;justify-content:space-between;gap:24px;margin:5px 0"><span style="color:#fcd34d">● Confirmed exits</span><strong>${exits.toLocaleString()}</strong></div><div style="display:flex;justify-content:space-between;gap:24px;border-top:1px solid #334155;padding-top:8px;margin-top:8px"><span style="color:#cbd5e1">Net movement</span><strong style="color:${netColor}">${netLabel}</strong></div>`;
      },
    },
    legend: {
      bottom: 0,
      left: "center",
      data: ["Hires", "Confirmed exits"],
      itemWidth: 20,
      itemHeight: 4,
      itemGap: 28,
      icon: "roundRect",
      textStyle: { color: "#64748b", fontSize: 12, padding: [0, 0, 0, 3] },
    },
    grid: { top: 32, right: 22, bottom: 62, left: 48, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: true,
      data: data?.months.map(monthLabel) ?? [],
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisLabel: { hideOverlap: true, color: "#64748b", fontSize: 11, margin: 14 },
      axisPointer: { label: { backgroundColor: "#4338ca", padding: [5, 8], borderRadius: 5 } },
    },
    yAxis: {
      type: "value",
      min: 0,
      minInterval: 1,
      name: "People",
      nameTextStyle: { color: "#94a3b8", fontSize: 11, padding: [0, 0, 8, 0] },
      axisLabel: { color: "#64748b", fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#e9edf5", type: "dashed" } },
    },
    series: [
      {
        name: "Hires",
        type: "bar",
        animationDelay: (index: number) => index * 10,
        barMaxWidth: 30,
        data: data?.months.map((month) => data.movement.hiresByMonth[month] ?? 0) ?? [],
        itemStyle: { color: indigo, borderRadius: [7, 7, 0, 0] },
        emphasis: {
          focus: "series",
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(79,70,229,.3)" },
        },
        z: 3,
      },
      {
        name: "Confirmed exits",
        type: "bar",
        animationDelay: (index: number) => index * 10 + 100,
        barMaxWidth: 30,
        data: data?.months.map((month) => data.movement.exitsByMonth[month] ?? 0) ?? [],
        itemStyle: { color: amber, borderRadius: [7, 7, 0, 0] },
        emphasis: {
          focus: "series",
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(217,119,6,.28)" },
        },
        z: 2,
      },
    ],
  };

  const departmentOption: EChartsOption = {
    ...baseOption(),
    animationDuration: 800,
    animationEasing: "cubicOut",
    grid: { top: 34, right: 18, bottom: 62, left: 48, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: "rgba(99, 102, 241, 0.07)" } },
      confine: true,
      backgroundColor: "#0f172a",
      borderWidth: 0,
      padding: [12, 15],
      textStyle: { color: "#f8fafc", fontSize: 12 },
      extraCssText: "border-radius: 12px; box-shadow: 0 12px 32px rgba(15,23,42,.22);",
      formatter: (params) => {
        const point = Array.isArray(params) ? params[0] : params;
        const name = String(point.name ?? "Department");
        const value = Number(point.value ?? 0);
        const total = data?.workforce.byDepartment.reduce((sum, item) => sum + item.value, 0) ?? 0;
        const share = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
        return `<div style="font-weight:600;margin-bottom:6px">${name}</div><div style="font-size:12px;color:#cbd5e1">${value.toLocaleString()} staff <span style="color:#a5b4fc;margin-left:8px">${share}% of workforce</span></div>`;
      },
    },
    xAxis: {
      type: "category",
      data: (data?.workforce.byDepartment ?? []).map((item) => item.name),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisLabel: {
        interval: 0,
        hideOverlap: true,
        rotate: 22,
        margin: 15,
        color: "#64748b",
        fontSize: 11,
        width: 105,
        overflow: "truncate",
      },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      name: "Staff members",
      nameTextStyle: { color: "#94a3b8", fontSize: 11, padding: [0, 0, 8, 0] },
      axisLabel: { color: "#64748b", fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#e9edf5", type: "dashed" } },
    },
    series: [{
      type: "bar",
      name: "Staff",
      data: (data?.workforce.byDepartment ?? []).map((item) => ({
        name: item.name,
        value: item.value,
        itemStyle: {
          borderRadius: [8, 8, 2, 2],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#818cf8" },
              { offset: 0.48, color: "#6366f1" },
              { offset: 1, color: "#4338ca" },
            ],
          },
          shadowColor: "rgba(79, 70, 229, 0.12)",
          shadowBlur: 8,
          shadowOffsetY: 3,
        },
      })),
      barMaxWidth: 46,
      barMinHeight: 3,
      showBackground: true,
      backgroundStyle: {
        color: "rgba(148, 163, 184, 0.07)",
        borderRadius: [8, 8, 2, 2],
      },
      label: {
        show: true,
        position: "top",
        distance: 9,
        color: "#475569",
        fontSize: 11,
        fontWeight: 700,
        formatter: (params) => Number(params.value ?? 0).toLocaleString(),
      },
      emphasis: {
        focus: "self",
        itemStyle: {
          shadowColor: "rgba(79, 70, 229, 0.32)",
          shadowBlur: 18,
          shadowOffsetY: 5,
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#a5b4fc" },
              { offset: 1, color: "#4f46e5" },
            ],
          },
        },
      },
      animationDelay: (index: number) => index * 45,
    }],
  };

  const attendanceDays = data?.attendance.daily ?? [];
  const attendanceDayMs = 24 * 60 * 60 * 1000;
  const attendanceTimestamps = attendanceDays.map((item) =>
    Date.parse(`${item.date}T00:00:00.000Z`)
  );
  const attendanceBreaks = attendanceTimestamps.slice(1).flatMap((timestamp, index) => {
    const previousTimestamp = attendanceTimestamps[index];
    if (timestamp - previousTimestamp <= attendanceDayMs) return [];
    return [{
      start: previousTimestamp + attendanceDayMs,
      end: timestamp,
      gap: "1%",
    }];
  });
  const attendanceStatuses = [
    "PRESENT",
    "LATE",
    "ABSENT",
    "LEAVE",
    "SICK",
    "APPROVED_ABSENCE",
  ] as const;
  const attendanceColors = [teal, amber, "#dc6666", "#818cf8", slate, "#94a3b8"];

  const attendanceOption: EChartsOption = {
    ...baseOption(),
    animationDuration: 700,
    tooltip: {
      trigger: "axis",
      confine: true,
      axisPointer: { type: "line" },
    },
    legend: { top: 0, type: "scroll" },
    grid: { top: 38, right: 20, bottom: 76, left: 44, containLabel: true },
    xAxis: {
      type: "time",
      breaks: attendanceBreaks,
      breakArea: {
        show: true,
        itemStyle: { color: "rgba(148, 163, 184, 0.12)" },
        zigzagAmplitude: 4,
      },
      axisLabel: {
        hideOverlap: true,
        formatter: (value: string | number) =>
          new Date(Number(value)).toISOString().slice(5, 10),
      },
      axisPointer: { label: { show: true } },
    },
    yAxis: {
      type: "value",
      min: 0,
      minInterval: 1,
      name: "Records",
      nameGap: 12,
    },
    dataZoom: attendanceDays.length > 1
      ? [
          { type: "inside", xAxisIndex: 0, filterMode: "none" },
          {
            type: "slider",
            xAxisIndex: 0,
            bottom: 4,
            height: 18,
            minValueSpan: attendanceDayMs,
            showDetail: false,
            showDataShadow: false,
            borderColor: "transparent",
            backgroundColor: "rgba(148, 163, 184, 0.12)",
            fillerColor: "rgba(99, 102, 241, 0.16)",
            handleStyle: { color: indigo, borderColor: indigo },
          },
        ]
      : [],
    series: attendanceStatuses.map((status, index) => ({
      name: label(status),
      type: "line" as const,
      stack: "attendance",
      showSymbol: false,
      connectNulls: false,
      emphasis: { focus: "series" as const },
      data: attendanceDays.flatMap((item, dayIndex) => {
        const timestamp = attendanceTimestamps[dayIndex];
        const point: [number, number] = [
          timestamp,
          Number(item[status] ?? 0),
        ];
        const nextTimestamp = attendanceTimestamps[dayIndex + 1];
        return nextTimestamp !== undefined && nextTimestamp - timestamp > attendanceDayMs
          ? [point, [timestamp + attendanceDayMs, Number.NaN] as [number, number]]
          : [point];
      }),
      lineStyle: { width: 2, color: attendanceColors[index] },
      itemStyle: { color: attendanceColors[index] },
      areaStyle: { opacity: 0.14 },
    })),
  };

  const leaveTrendOption: EChartsOption = {
    ...baseOption(),
    tooltip: { trigger: "axis", confine: true },
    xAxis: { type: "category", data: data?.months.map(monthLabel) ?? [] },
    yAxis: { type: "value", minInterval: 1, name: "Requests" },
    series: [{
      name: "Leave requests",
      type: "bar",
      barMaxWidth: 30,
      data: data?.months.map((month) => data.leave.byMonth[month] ?? 0) ?? [],
      itemStyle: { color: teal, borderRadius: [5, 5, 0, 0] },
    }],
  };

  const recruitmentOption: EChartsOption = {
    ...baseOption(),
    grid: { top: 12, right: 24, bottom: 20, left: 12, containLabel: true },
    tooltip: { trigger: "axis", confine: true },
    xAxis: { type: "value", minInterval: 1 },
    yAxis: {
      type: "category",
      inverse: true,
      data: Object.keys(data?.recruitment.applicationsByStage ?? {}).reverse().map(label),
      axisLabel: { width: 120, overflow: "truncate" },
    },
    series: [{
      name: "Applications",
      type: "bar",
      barMaxWidth: 24,
      data: Object.entries(data?.recruitment.applicationsByStage ?? {}).reverse().map(([, value]) => value),
      itemStyle: { color: indigo, borderRadius: [0, 5, 5, 0] },
    }],
  };

  const trainingTrendOption: EChartsOption = {
    ...baseOption(),
    tooltip: { trigger: "axis", confine: true },
    xAxis: { type: "category", data: data?.months.map(monthLabel) ?? [] },
    yAxis: { type: "value", minInterval: 1, name: "Completions" },
    series: [{
      name: "Completed training",
      type: "line",
      smooth: true,
      symbolSize: 7,
      data: data?.months.map((month) => data.learning.trainingCompletionsByMonth[month] ?? 0) ?? [],
      lineStyle: { width: 3, color: teal },
      itemStyle: { color: teal },
      areaStyle: { opacity: 0.12 },
    }],
  };

  const performanceOption: EChartsOption = {
    ...baseOption(),
    tooltip: { trigger: "axis", confine: true },
    xAxis: {
      type: "category",
      data: data?.performance.ratingDistribution.map((item) => `${item.rating} / 5`) ?? [],
    },
    yAxis: { type: "value", minInterval: 1, name: "Reviews" },
    series: [{
      name: "Ratings",
      type: "bar",
      barMaxWidth: 42,
      data: data?.performance.ratingDistribution.map((item) => item.count) ?? [],
      itemStyle: { color: indigo, borderRadius: [5, 5, 0, 0] },
    }],
  };

  const offboardingOption = pieOption(data?.offboarding.byStatus ?? {}, "Offboarding status");

  return (
    <section className="w-full space-y-6 p-4 md:p-6 xl:p-8" aria-labelledby="staff-reports-title">
      <div className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 py-7 text-white shadow-lg shadow-slate-950/10 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full border border-white/[0.07]" />
        <div className="pointer-events-none absolute -right-2 -top-14 -z-10 h-56 w-56 rounded-full border border-white/[0.07]" />
        <div className="pointer-events-none absolute bottom-0 right-24 -z-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,.8)]" />
              People &amp; HR <span className="text-white/35">/</span> Insights &amp; Control
            </div>
            <h1 id="staff-reports-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Workforce intelligence
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              A consolidated view of workforce composition, employee movement, attendance, recruitment, learning, performance and offboarding.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-indigo-300" /> Eight reporting domains</span>
              <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-teal-300" /> Aggregated school data</span>
            </div>
          </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/[0.08] px-4 text-sm font-semibold text-white shadow-sm backdrop-blur transition hover:border-white/30 hover:bg-white/[0.15] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={refreshing ? "animate-spin" : ""} aria-hidden="true">⟳</span>
          {refreshing ? "Refreshing…" : "Refresh reports"}
        </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm shadow-slate-950/[0.025] sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold tracking-tight text-foreground">Report filters</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Adjust the reporting window and organizational scope.</p>
          </div>
          <span className="rounded-full border border-indigo-200/70 bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-300">
            {department ? "Department view" : "All departments"}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-40 flex-1 gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Start date
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
          />
        </label>
        <label className="grid min-w-40 flex-1 gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          End date
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
          />
        </label>
        <label className="grid min-w-48 flex-[1.2] gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Department
          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"
          >
            <option value="">All departments</option>
            {departments.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <div className="flex min-h-11 min-w-48 flex-1 flex-col justify-center rounded-xl bg-muted/50 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Active reporting period</span>
          <span className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">
            {data ? `${data.filters.from} — ${data.filters.to}` : "Last 12 months"}
          </span>
        </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-xl border border-border p-12 text-center text-sm text-muted-foreground">
          Loading workforce reports…
        </div>
      ) : data ? (
        <>
          <div className="space-y-3">
            <SectionHeading
              eyebrow="01 / Workforce intelligence"
              title="Workforce overview"
              description="Current workforce composition and distribution. Workforce totals are a current snapshot, independent of the selected reporting period."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <Metric label="Total staff" value={data.workforce.total} detail="Current workforce" />
              <Metric label="Active" value={data.workforce.byStatus.ACTIVE ?? 0} detail="Active employees" />
              <Metric label="On leave" value={data.workforce.byStatus.ON_LEAVE ?? 0} detail="Current status" />
              <Metric label="Suspended" value={data.workforce.byStatus.SUSPENDED ?? 0} detail="Current status" />
              <Metric label="Inactive" value={data.workforce.byStatus.INACTIVE ?? 0} detail="Current status" />
              <Metric label="Terminated" value={data.workforce.byStatus.TERMINATED ?? 0} detail="Current status" />
            </div>
            <Panel title="Staff by department" description="Current employee distribution across departments.">
              {data.workforce.byDepartment.length ? (
                <EChartsReact option={departmentOption} style={chartHeight} notMerge lazyUpdate />
              ) : <EmptyChart message="No workforce records are available for this selection." />}
            </Panel>
          </div>

          <div className="space-y-3">
            <SectionHeading
              eyebrow="02 / Workforce movement"
              title="Hiring and confirmed exits"
              description="Monthly hires compared with completed offboarding records using their effective termination dates."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Hires" value={data.movement.hires} detail="Within selected period" />
              <Metric label="Confirmed exits" value={data.movement.confirmedExits} detail="Completed offboarding only" />
              <Metric label="Net movement" value={data.movement.hires - data.movement.confirmedExits} detail="Hires less confirmed exits" />
            </div>
            <Panel title="Monthly workforce movement" description="Hiring and confirmed exits over the selected period.">
              <EChartsReact option={movementOption} style={chartHeight} notMerge lazyUpdate />
            </Panel>
          </div>

          <div className="space-y-3">
            <SectionHeading
              eyebrow="03 / Attendance intelligence"
              title="Attendance and punctuality"
              description="Daily recorded attendance statuses and lateness indicators."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Attendance records" value={data.attendance.totalRecords} detail="Records in selected period" />
              <Metric label="Late records" value={data.attendance.lateCount} detail="Marked late" />
              <Metric label="Average lateness" value={data.attendance.averageLateMinutes === null ? "—" : `${data.attendance.averageLateMinutes} min`} detail="Among late records" />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Panel title="Daily attendance trend" description="Stacked daily status totals on a calendar timeline, with unrecorded date intervals compressed into visible breaks.">
                {data.attendance.daily.length ? (
                  <EChartsReact option={attendanceOption} style={chartHeight} notMerge lazyUpdate />
                ) : <EmptyChart message="No attendance records found for this period." />}
              </Panel>
              <Panel title="Attendance status distribution" description="Share of recorded attendance statuses.">
                {data.attendance.totalRecords ? (
                  <EChartsReact option={pieOption(data.attendance.byStatus, "Attendance")} style={chartHeight} notMerge lazyUpdate />
                ) : <EmptyChart message="No attendance status data is available." />}
              </Panel>
            </div>
          </div>

          <div className="space-y-3">
            <SectionHeading
              eyebrow="04 / Leave analysis"
              title="Leave requests"
              description="Leave request volume, request types, and workflow outcomes."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Total requests" value={data.leave.total} detail="Submitted in selected period" />
              <Metric label="Pending" value={data.leave.byStatus.PENDING ?? 0} detail="Awaiting review" />
              <Metric label="Approved" value={data.leave.byStatus.APPROVED ?? 0} detail="Approved requests" />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Panel title="Leave by type" description="Distribution across leave categories.">
                {data.leave.total ? (
                  <EChartsReact option={pieOption(data.leave.byType, "Leave type")} style={chartHeight} notMerge lazyUpdate />
                ) : <EmptyChart message="No leave requests found for this period." />}
              </Panel>
              <Panel title="Monthly leave requests" description="Requests grouped by submission month.">
                <EChartsReact option={leaveTrendOption} style={chartHeight} notMerge lazyUpdate />
              </Panel>
            </div>
          </div>

          <div className="space-y-3">
            <SectionHeading
              eyebrow="05 / Recruitment performance"
              title="Recruitment pipeline"
              description="Job opening activity and application progression. Hired applications are kept separate from offers."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Job openings" value={data.recruitment.openings} detail="Created in selected period" />
              <Metric label="Applications" value={data.recruitment.applications} detail="Received in selected period" />
              <Metric label="Offered" value={data.recruitment.applicationsByStage.OFFERED ?? 0} detail="Offers issued" />
              <Metric label="Hired" value={data.recruitment.applicationsByStage.HIRED ?? 0} detail="Marked as hired" />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Panel title="Application pipeline" description="Applications by their current recruitment stage.">
                {data.recruitment.applications ? (
                  <EChartsReact option={recruitmentOption} style={chartHeight} notMerge lazyUpdate />
                ) : <EmptyChart message="No applications found for this period." />}
              </Panel>
              <Panel title="Job opening status" description="Current recorded status of openings created in the period.">
                {data.recruitment.openings ? (
                  <EChartsReact option={pieOption(data.recruitment.openingsByStatus, "Opening status")} style={chartHeight} notMerge lazyUpdate />
                ) : <EmptyChart message="No job openings found for this period." />}
              </Panel>
            </div>
          </div>

          <div className="space-y-3">
            <SectionHeading
              eyebrow="06 / Learning & development"
              title="Training and development"
              description="Training participation, completion, development plans, and goal progress."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Training records" value={data.learning.trainingTotal} detail="Training in selected period" />
              <Metric label="Completed training" value={data.learning.completedTraining} detail="Marked completed" />
              <Metric label="Development plans" value={data.learning.developmentPlans} detail="Plans created in period" />
              <Metric label="Goal progress" value={data.learning.averageDevelopmentProgress === null ? "—" : `${data.learning.averageDevelopmentProgress}%`} detail={`${data.learning.developmentGoals} development goals`} />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Panel title="Training completion trend" description="Completed training records grouped by completion month.">
                <EChartsReact option={trainingTrendOption} style={chartHeight} notMerge lazyUpdate />
              </Panel>
              <Panel title="Training status" description="Training records by current status.">
                {data.learning.trainingTotal ? (
                  <EChartsReact option={pieOption(data.learning.trainingByStatus, "Training status")} style={chartHeight} notMerge lazyUpdate />
                ) : <EmptyChart message="No training records found for this period." />}
              </Panel>
            </div>
          </div>

          <div className="space-y-3">
            <SectionHeading
              eyebrow="07 / Performance intelligence"
              title="Reviews and performance goals"
              description="Review activity, rating distribution, and goal progress."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Review cycles" value={data.performance.reviewCycles} detail="Cycles starting in period" />
              <Metric label="Reviews" value={data.performance.reviews} detail="Reviews created in period" />
              <Metric label="Average rating" value={data.performance.averageRating?.toFixed(2) ?? "—"} detail="Available review ratings / 5" />
              <Metric label="Goal progress" value={data.performance.averageGoalProgress === null ? "—" : `${data.performance.averageGoalProgress}%`} detail={`${data.performance.goals} performance goals`} />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Panel title="Performance rating distribution" description="Recorded overall ratings on a five-point scale.">
                {data.performance.ratingDistribution.some((item) => item.count > 0) ? (
                  <EChartsReact option={performanceOption} style={chartHeight} notMerge lazyUpdate />
                ) : <EmptyChart message="No performance ratings are available for this period." />}
              </Panel>
              <Panel title="Review status" description="Reviews by workflow status.">
                {data.performance.reviews ? (
                  <EChartsReact option={pieOption(data.performance.reviewsByStatus, "Review status")} style={chartHeight} notMerge lazyUpdate />
                ) : <EmptyChart message="No performance reviews found for this period." />}
              </Panel>
            </div>
          </div>

          <div className="space-y-3">
            <SectionHeading
              eyebrow="08 / Offboarding intelligence"
              title="Employee exits and clearance"
              description="Offboarding workflow progress, exit categories, and required task completion."
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Offboarding records" value={data.offboarding.records} detail="Created in selected period" />
              <Metric label="Confirmed exits" value={data.offboarding.confirmedExits} detail="Completed workflows only" />
              <Metric label="Required tasks" value={data.offboarding.requiredTasks} detail={`${data.offboarding.completedRequiredTasks} completed`} />
              <Metric label="Task completion" value={data.offboarding.requiredTaskCompletionRate === null ? "—" : `${data.offboarding.requiredTaskCompletionRate}%`} detail={`${data.offboarding.waivedTasks} waived tasks tracked separately`} />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Panel title="Offboarding workflow status" description="Distribution of offboarding records by status.">
                {data.offboarding.records ? (
                  <EChartsReact option={offboardingOption} style={chartHeight} notMerge lazyUpdate />
                ) : <EmptyChart message="No offboarding records found for this period." />}
              </Panel>
              <Panel title="Exit types" description="Recorded reasons for employee offboarding.">
                {data.offboarding.records ? (
                  <EChartsReact option={pieOption(data.offboarding.byExitType, "Exit type")} style={chartHeight} notMerge lazyUpdate />
                ) : <EmptyChart message="No exit type data is available." />}
              </Panel>
            </div>
          </div>

          <div className="border-t border-border pt-4 text-xs text-muted-foreground">
            <p>
              Aggregate reporting only. Confirmed exits include completed offboarding records with an effective termination date in the selected period. Waived offboarding tasks are reported separately and are not counted as completed required tasks.
            </p>
            <p className="mt-1">
              Generated {new Date(data.generatedAt).toLocaleString()}.
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}
