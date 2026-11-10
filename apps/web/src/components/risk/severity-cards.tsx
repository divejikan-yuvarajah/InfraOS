"use client";

import type { RiskOverviewDto } from "@/lib/risk/types";
import { LEVEL_CONFIG } from "@/lib/risk/view";

export function SeverityCards({
  overview,
  selectedLevel,
  isStaleFilter,
  isUnacknowledgedFilter,
  onSelectLevel,
  onToggleStale,
  onToggleUnacknowledged,
}: {
  overview?: RiskOverviewDto | null;
  selectedLevel?: string;
  isStaleFilter?: boolean;
  isUnacknowledgedFilter?: boolean;
  onSelectLevel: (level?: string) => void;
  onToggleStale: () => void;
  onToggleUnacknowledged: () => void;
}) {
  const counts = overview?.counts;

  const totalAssessed = counts?.assessed ?? 0;
  const staleCount = counts?.stale ?? 0;
  const unackCount = counts?.unacknowledgedHighPlus ?? 0;

  const cards = [
    {
      id: "TOTAL",
      label: "Total Assessed",
      count: totalAssessed,
      active: !selectedLevel && !isStaleFilter && !isUnacknowledgedFilter,
      badgeClass: "border-border bg-surface text-text-primary",
      onClick: () => onSelectLevel(undefined),
    },
    {
      id: "CRITICAL",
      label: "Critical",
      glyph: LEVEL_CONFIG.CRITICAL.glyph,
      count: counts?.critical ?? 0,
      active: selectedLevel === "CRITICAL",
      badgeClass: LEVEL_CONFIG.CRITICAL.badgeClass,
      borderActive: "ring-2 ring-rose-500",
      onClick: () => onSelectLevel(selectedLevel === "CRITICAL" ? undefined : "CRITICAL"),
    },
    {
      id: "HIGH",
      label: "High",
      glyph: LEVEL_CONFIG.HIGH.glyph,
      count: counts?.high ?? 0,
      active: selectedLevel === "HIGH",
      badgeClass: LEVEL_CONFIG.HIGH.badgeClass,
      borderActive: "ring-2 ring-orange-500",
      onClick: () => onSelectLevel(selectedLevel === "HIGH" ? undefined : "HIGH"),
    },
    {
      id: "MODERATE",
      label: "Moderate",
      glyph: LEVEL_CONFIG.MODERATE.glyph,
      count: counts?.moderate ?? 0,
      active: selectedLevel === "MODERATE",
      badgeClass: LEVEL_CONFIG.MODERATE.badgeClass,
      borderActive: "ring-2 ring-amber-500",
      onClick: () => onSelectLevel(selectedLevel === "MODERATE" ? undefined : "MODERATE"),
    },
    {
      id: "LOW",
      label: "Low",
      glyph: LEVEL_CONFIG.LOW.glyph,
      count: counts?.low ?? 0,
      active: selectedLevel === "LOW",
      badgeClass: LEVEL_CONFIG.LOW.badgeClass,
      borderActive: "ring-2 ring-emerald-500",
      onClick: () => onSelectLevel(selectedLevel === "LOW" ? undefined : "LOW"),
    },
    {
      id: "NOT_ASSESSABLE",
      label: "Not Assessable",
      glyph: "?",
      count: counts?.notAssessable ?? 0,
      active: selectedLevel === "NOT_ASSESSABLE",
      badgeClass: LEVEL_CONFIG.NOT_ASSESSABLE.badgeClass,
      borderActive: "ring-2 ring-slate-500",
      onClick: () =>
        onSelectLevel(selectedLevel === "NOT_ASSESSABLE" ? undefined : "NOT_ASSESSABLE"),
    },
    {
      id: "STALE",
      label: "Stale (> 7d)",
      glyph: "⏱",
      count: staleCount,
      active: isStaleFilter,
      badgeClass: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200",
      borderActive: "ring-2 ring-amber-500",
      onClick: onToggleStale,
    },
    {
      id: "UNACKNOWLEDGED",
      label: "Unacknowledged High+",
      glyph: "⚠️",
      count: unackCount,
      active: isUnacknowledgedFilter,
      badgeClass: "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200",
      borderActive: "ring-2 ring-rose-500",
      onClick: onToggleUnacknowledged,
    },
  ];

  return (
    <div
      role="region"
      aria-label="Portfolio Risk Metrics"
      className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3"
    >
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={c.onClick}
          className={`flex flex-col justify-between p-3 rounded-lg border text-left transition-all hover:shadow-xs focus-visible:outline-2 focus-visible:outline-ring ${
            c.badgeClass
          } ${c.active ? `${c.borderActive ?? "ring-2 ring-infra-orange"} shadow-sm font-bold` : "opacity-90"}`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="truncate">{c.label}</span>
            {c.glyph ? (
              <span className="font-mono text-sm leading-none ml-1">{c.glyph}</span>
            ) : null}
          </div>
          <span className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
            {c.count}
          </span>
        </button>
      ))}
    </div>
  );
}
