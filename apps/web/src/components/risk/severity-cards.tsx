"use client";

import {
  DashboardKpiCard,
  DashboardKpiGrid,
  type DashboardKpiTone,
} from "@/components/common/civic-atlas-primitives";
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

  const cards: {
    id: string;
    label: string;
    glyph?: string;
    count: number;
    active: boolean;
    tone: DashboardKpiTone;
    onClick: () => void;
  }[] = [
    {
      id: "TOTAL",
      label: "Total Assessed",
      count: totalAssessed,
      active: !selectedLevel && !isStaleFilter && !isUnacknowledgedFilter,
      tone: "brand",
      onClick: () => onSelectLevel(undefined),
    },
    {
      id: "CRITICAL",
      label: "Critical",
      glyph: LEVEL_CONFIG.CRITICAL.glyph,
      count: counts?.critical ?? 0,
      active: selectedLevel === "CRITICAL",
      tone: "critical",
      onClick: () => onSelectLevel(selectedLevel === "CRITICAL" ? undefined : "CRITICAL"),
    },
    {
      id: "HIGH",
      label: "High",
      glyph: LEVEL_CONFIG.HIGH.glyph,
      count: counts?.high ?? 0,
      active: selectedLevel === "HIGH",
      tone: "brand",
      onClick: () => onSelectLevel(selectedLevel === "HIGH" ? undefined : "HIGH"),
    },
    {
      id: "MODERATE",
      label: "Moderate",
      glyph: LEVEL_CONFIG.MODERATE.glyph,
      count: counts?.moderate ?? 0,
      active: selectedLevel === "MODERATE",
      tone: "warning",
      onClick: () => onSelectLevel(selectedLevel === "MODERATE" ? undefined : "MODERATE"),
    },
    {
      id: "LOW",
      label: "Low",
      glyph: LEVEL_CONFIG.LOW.glyph,
      count: counts?.low ?? 0,
      active: selectedLevel === "LOW",
      tone: "success",
      onClick: () => onSelectLevel(selectedLevel === "LOW" ? undefined : "LOW"),
    },
    {
      id: "NOT_ASSESSABLE",
      label: "Not Assessable",
      glyph: "?",
      count: counts?.notAssessable ?? 0,
      active: selectedLevel === "NOT_ASSESSABLE",
      tone: "neutral",
      onClick: () =>
        onSelectLevel(selectedLevel === "NOT_ASSESSABLE" ? undefined : "NOT_ASSESSABLE"),
    },
    {
      id: "STALE",
      label: "Stale (> 7d)",
      glyph: "⏱",
      count: staleCount,
      active: Boolean(isStaleFilter),
      tone: "warning",
      onClick: onToggleStale,
    },
    {
      id: "UNACKNOWLEDGED",
      label: "Unack. High+",
      glyph: "▲",
      count: unackCount,
      active: Boolean(isUnacknowledgedFilter),
      tone: "critical",
      onClick: onToggleUnacknowledged,
    },
  ];

  const primaryCards = cards.filter((c) => !["NOT_ASSESSABLE", "STALE"].includes(c.id));
  const secondaryChips = cards.filter((c) => ["NOT_ASSESSABLE", "STALE"].includes(c.id));

  return (
    <div className="space-y-2.5">
      <DashboardKpiGrid columns={6} label="Portfolio Risk Metrics">
        {primaryCards.map((c) => (
          <DashboardKpiCard
            key={c.id}
            label={c.label}
            value={c.count}
            tone={c.tone}
            active={c.active}
            badge={
              c.glyph ? (
                <span className="font-mono text-xs text-slate-500 leading-none" aria-hidden="true">
                  {c.glyph}
                </span>
              ) : undefined
            }
            onClick={c.onClick}
          />
        ))}
      </DashboardKpiGrid>
      <div className="flex flex-wrap items-center gap-2">
        {secondaryChips.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.active}
            onClick={c.onClick}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              c.active
                ? "border-[#ff5b00] bg-[#fff7ed] text-[#9a3412]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>{c.label}</span>
            <span className="font-mono tabular-nums">{c.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
