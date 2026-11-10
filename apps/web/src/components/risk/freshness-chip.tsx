"use client";

import { formatDaysAgo } from "@/lib/risk/view";

export function FreshnessChip({
  asOf,
  stale,
  sourceName,
  className = "",
}: {
  asOf: string | null | undefined;
  stale?: boolean;
  sourceName?: string;
  className?: string;
}) {
  const timeLabel = formatDaysAgo(asOf);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] tabular-nums ${
        stale
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
      } ${className}`}
      title={stale ? "Source data is stale (> SLA threshold)" : undefined}
    >
      <span
        className={`size-1.5 rounded-full ${stale ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`}
        aria-hidden="true"
      />
      <span>
        {sourceName ? `${sourceName} ` : ""}
        {timeLabel}
      </span>
    </span>
  );
}
