"use client";

import { useCallback, useEffect, useState } from "react";
import EChartsReact from "echarts-for-react";
import type { EChartsOption } from "echarts";

type Analytics = {
  generatedAt: string;
  cycles: {
    total: number;
    byStatus: { DRAFT: number; OPEN: number; CLOSED: number };
  };
  reviews: {
    total: number;
    finalized: number;
    outstanding: number;
    completionRate: number;
    byStatus: Record<string, number>;
    averageRating: number | null;
    ratingCount: number;
    ratingDistribution: { rating: number; count: number }[];
  };
  goals: {
    total: number;
    byStatus: Record<string, number>;
    completed: number;
    averageProgress: number | null;
    completionRate: number;
  };
  competencies: {
    name: string;
    averageRating: number;
    count: number;
  }[];
  cycleTrend: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    totalReviews: number;
    finalizedReviews: number;
    completionRate: number;
    averageRating: number | null;
  }[];
};

const panelClass =
  "min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5";
const chartHeight = { height: 300, width: "100%" };

function baseOption(): EChartsOption {
  return {
    animationDuration: 350,
    textStyle: { fontFamily: "inherit" },
    tooltip: { trigger: "axis", confine: true },
    grid: { top: 28, right: 20, bottom: 45, left: 42, containLabel: true },
  };
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export function StaffPerformanceAnalytics({
  schoolId,
}: {
  schoolId: string;
}) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/performance/analytics`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as Analytics & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Unable to load performance analytics.");
      }

      setData(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load performance analytics.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolId]);

  useEffect(() => {
    let active = true;

    async function fetchInitialAnalytics() {
      try {
        const response = await fetch(
          `/api/schools/${encodeURIComponent(schoolId)}/performance/analytics`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as Analytics & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to load performance analytics.",
          );
        }

        if (active) setData(result);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load performance analytics.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchInitialAnalytics();

    return () => {
      active = false;
    };
  }, [schoolId]);

  const ratingOption: EChartsOption = {
    ...baseOption(),
    tooltip: { trigger: "axis", confine: true },
    xAxis: {
      type: "category",
      name: "Rating",
      data: data?.reviews.ratingDistribution.map((item) => `${item.rating} / 5`) ?? [],
    },
    yAxis: { type: "value", minInterval: 1, name: "Reviews" },
    series: [{
      type: "bar",
      name: "Finalized reviews",
      data: data?.reviews.ratingDistribution.map((item) => item.count) ?? [],
      barMaxWidth: 42,
      itemStyle: { color: "#6366f1", borderRadius: [5, 5, 0, 0] },
    }],
  };

  const trendOption: EChartsOption = {
    ...baseOption(),
    tooltip: { trigger: "axis", confine: true },
    legend: { bottom: 0, data: ["Average rating", "Completion rate"] },
    grid: { top: 25, right: 48, bottom: 65, left: 45, containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data?.cycleTrend.map((cycle) => cycle.name) ?? [],
      axisLabel: { hideOverlap: true, width: 100, overflow: "truncate" },
    },
    yAxis: [
      { type: "value", name: "Rating", min: 1, max: 5 },
      { type: "value", name: "Complete", min: 0, max: 100, axisLabel: { formatter: "{value}%" } },
    ],
    series: [
      {
        name: "Average rating",
        type: "line",
        smooth: true,
        connectNulls: false,
        data: data?.cycleTrend.map((cycle) => cycle.averageRating) ?? [],
        showSymbol: true,
        itemStyle: { color: "#6366f1" },
      },
      {
        name: "Completion rate",
        type: "line",
        yAxisIndex: 1,
        smooth: true,
        data: data?.cycleTrend.map((cycle) => cycle.completionRate) ?? [],
        showSymbol: true,
        itemStyle: { color: "#0d9488" },
      },
    ],
  };

  const goalOption: EChartsOption = {
    ...baseOption(),
    tooltip: { trigger: "item", confine: true },
    legend: { bottom: 0, left: "center", type: "scroll" },
    series: [{
      name: "Goals",
      type: "pie",
      radius: ["48%", "72%"],
      center: ["50%", "43%"],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: "var(--background)", borderWidth: 2 },
      label: { formatter: "{b}: {c}" },
      data: Object.entries(data?.goals.byStatus ?? {})
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name: name.replaceAll("_", " "), value })),
    }],
  };

  const competencyOption: EChartsOption = {
    ...baseOption(),
    grid: { top: 12, right: 24, bottom: 20, left: 12, containLabel: true },
    tooltip: { trigger: "axis", confine: true },
    xAxis: {
      type: "value",
      min: 0,
      max: 5,
      name: "Average rating",
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: [...(data?.competencies ?? [])].reverse().map((item) => item.name),
      axisLabel: { width: 150, overflow: "truncate" },
    },
    series: [{
      type: "bar",
      name: "Average rating",
      barMaxWidth: 24,
      data: [...(data?.competencies ?? [])].reverse().map((item) => ({
        value: item.averageRating,
        count: item.count,
        name: item.name,
      })),
      itemStyle: { color: "#0d9488", borderRadius: [0, 5, 5, 0] },
    }],
  };

  return (
    <section className="space-y-4" aria-labelledby="performance-analytics-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Performance intelligence
          </p>
          <h2 id="performance-analytics-title" className="mt-1 text-lg font-semibold tracking-tight">
            Analytics &amp; reporting
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            School-wide review outcomes, cycle trends, competencies, and goal progress.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
        >
          <span aria-hidden="true">{refreshing ? "↻" : "⟳"}</span>
          Refresh analytics
        </button>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="font-medium underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          Loading performance analytics…
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Metric
              label="Review completion"
              value={`${data.reviews.completionRate}%`}
              detail={`${data.reviews.finalized} finalized of ${data.reviews.total} assigned`}
            />
            <Metric
              label="Average rating"
              value={data.reviews.averageRating?.toFixed(2) ?? "—"}
              detail={`${data.reviews.ratingCount} finalized reviews with ratings`}
            />
            <Metric
              label="Outstanding reviews"
              value={data.reviews.outstanding}
              detail="Draft or in progress"
            />
            <Metric
              label="Goal progress"
              value={data.goals.averageProgress === null ? "—" : `${data.goals.averageProgress}%`}
              detail={`${data.goals.completed} completed of ${data.goals.total} goals`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className={panelClass}>
              <h3 className="font-semibold">Finalized rating distribution</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ratings from submitted and acknowledged reviews only.
              </p>
              {data.reviews.ratingCount ? (
                <EChartsReact option={ratingOption} style={chartHeight} notMerge lazyUpdate />
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  No finalized ratings available yet.
                </p>
              )}
            </div>

            <div className={panelClass}>
              <h3 className="font-semibold">Performance by review cycle</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Average rating and review completion across cycles.
              </p>
              {data.cycleTrend.length ? (
                <EChartsReact option={trendOption} style={chartHeight} notMerge lazyUpdate />
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Create a review cycle to begin tracking trends.
                </p>
              )}
            </div>

            <div className={panelClass}>
              <h3 className="font-semibold">Goal status</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Distribution of school performance goals.
              </p>
              {data.goals.total ? (
                <EChartsReact option={goalOption} style={chartHeight} notMerge lazyUpdate />
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  No performance goals have been created yet.
                </p>
              )}
            </div>

            <div className={panelClass}>
              <h3 className="font-semibold">Competency ratings</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Average scores from finalized reviews; highest-volume competencies shown.
              </p>
              {data.competencies.length ? (
                <EChartsReact option={competencyOption} style={chartHeight} notMerge lazyUpdate />
              ) : (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Competency ratings will appear after reviews are finalized.
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Generated {new Date(data.generatedAt).toLocaleString()}.
            Ratings exclude draft and in-progress reviews. Goal progress excludes cancelled goals.
          </p>
        </>
      ) : null}
    </section>
  );
}
