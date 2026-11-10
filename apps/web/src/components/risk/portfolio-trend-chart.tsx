"use client";

import { LEVEL_CONFIG } from "@/lib/risk/view";

interface TrendPoint {
  weekStart: string;
  counts: Record<string, number>;
}

export function PortfolioTrendChart({
  points,
  insufficientHistory,
  className = "",
}: {
  points?: TrendPoint[];
  insufficientHistory?: boolean;
  className?: string;
}) {
  const data = points ?? [];

  if (insufficientHistory || data.length < 3) {
    return (
      <div
        className={`rounded-lg border border-border bg-surface p-4 shadow-2xs flex flex-col items-center justify-center text-center min-h-[220px] space-y-2 ${className}`}
      >
        <span className="text-2xl" aria-hidden="true">
          📈
        </span>
        <h4 className="text-sm font-semibold text-text-primary">
          Collecting Historical Risk Trend
        </h4>
        <p className="text-xs text-text-muted max-w-sm">
          {data.length} weekly snapshot{data.length === 1 ? "" : "s"} recorded. A minimum of 3 consecutive weekly snapshots are required to plot longitudinal risk drift.
        </p>
      </div>
    );
  }

  // Calculate max total in any week
  const maxTotal = Math.max(
    1,
    ...data.map((p) =>
      Object.values(p.counts).reduce((sum, count) => sum + (count || 0), 0),
    ),
  );

  return (
    <div
      className={`rounded-lg border border-border bg-surface p-4 shadow-2xs space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Portfolio Risk Trend
        </h3>
        <span className="text-xs text-text-muted">Weekly Distribution</span>
      </div>

      <div className="flex items-end gap-2 h-44 pt-4 pb-2 border-b border-border/40">
        {data.map((pt, idx) => {
          const crit = pt.counts.CRITICAL ?? 0;
          const high = pt.counts.HIGH ?? 0;
          const mod = pt.counts.MODERATE ?? 0;
          const low = pt.counts.LOW ?? 0;
          const total = crit + high + mod + low || 1;

          const critH = (crit / maxTotal) * 100;
          const highH = (high / maxTotal) * 100;
          const modH = (mod / maxTotal) * 100;
          const lowH = (low / maxTotal) * 100;

          const label = pt.weekStart.slice(5, 10);

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center h-full justify-end group"
              title={`Week ${pt.weekStart}: ${crit} Crit, ${high} High, ${mod} Mod, ${low} Low`}
            >
              <div className="w-full max-w-[32px] flex flex-col rounded-t overflow-hidden shadow-2xs">
                {critH > 0 ? (
                  <div style={{ height: `${critH}%` }} className={LEVEL_CONFIG.CRITICAL.bgClass} />
                ) : null}
                {highH > 0 ? (
                  <div style={{ height: `${highH}%` }} className={LEVEL_CONFIG.HIGH.bgClass} />
                ) : null}
                {modH > 0 ? (
                  <div style={{ height: `${modH}%` }} className={LEVEL_CONFIG.MODERATE.bgClass} />
                ) : null}
                {lowH > 0 ? (
                  <div style={{ height: `${lowH}%` }} className={LEVEL_CONFIG.LOW.bgClass} />
                ) : null}
              </div>
              <span className="text-[10px] text-text-muted font-mono mt-1 group-hover:text-text-primary">
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 text-[11px] text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-rose-600" /> Critical
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-orange-500" /> High
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-amber-500" /> Moderate
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-emerald-500" /> Low
        </span>
      </div>
    </div>
  );
}
