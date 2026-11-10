"use client";

import type { RiskFactorCategory, RiskOverviewDto } from "@/lib/risk/types";
import { CATEGORY_LABELS } from "@/lib/risk/view";

const ORDERED_CATEGORIES: RiskFactorCategory[] = [
  "DELAY",
  "PROGRESS",
  "BUDGET",
  "SCHEDULE",
  "COORDINATION",
];

export function CategoryBreakdown({
  overview,
  selectedCategory,
  onSelectCategory,
  className = "",
}: {
  overview?: RiskOverviewDto | null;
  selectedCategory?: string;
  onSelectCategory: (cat?: string) => void;
  className?: string;
}) {
  const categories = overview?.categories ?? ({} as any);
  const totalAssessed = overview?.counts?.assessed || 1;

  return (
    <div
      className={`rounded-lg border border-border bg-surface p-4 shadow-2xs space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Category Risk Exposure
        </h3>
        <span className="text-xs text-text-muted">≥ High Flagged Projects</span>
      </div>

      <div className="space-y-2.5">
        {ORDERED_CATEGORIES.map((cat) => {
          const count = categories[cat]?.highPlusCount ?? 0;
          const pct = Math.min(100, Math.round((count / totalAssessed) * 100));
          const label = CATEGORY_LABELS[cat] ?? cat;
          const isSelected = selectedCategory === cat;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(isSelected ? undefined : cat)}
              className={`w-full text-left rounded p-1.5 transition-colors hover:bg-surface-container-low focus:outline-none focus:ring-1 focus:ring-ring ${
                isSelected ? "bg-surface-container-low ring-1 ring-infra-orange" : ""
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-text-secondary">{label}</span>
                <span className="font-mono tabular-nums text-text-primary">
                  {count} ({pct}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high/40">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    count > 0 ? "bg-orange-500" : "bg-slate-300"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
