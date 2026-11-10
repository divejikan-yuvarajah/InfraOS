"use client";

import type { RiskCategorySummaryDto, RiskFactorCategory } from "@/lib/risk/types";
import { CATEGORY_LABELS, LEVEL_CONFIG } from "@/lib/risk/view";

const ORDERED_CATEGORIES: RiskFactorCategory[] = [
  "DELAY",
  "PROGRESS",
  "BUDGET",
  "SCHEDULE",
  "COORDINATION",
];

const SHORT_LABELS: Record<RiskFactorCategory, string> = {
  DELAY: "DL",
  PROGRESS: "PG",
  BUDGET: "BG",
  SCHEDULE: "SC",
  COORDINATION: "CO",
  OTHER: "OT",
};

export function CategoryStrip({
  categories,
  size = "md",
  className = "",
}: {
  categories?: RiskCategorySummaryDto[] | Record<string, any>;
  size?: "sm" | "md";
  className?: string;
}) {
  const catMap = new Map<RiskFactorCategory, { level: any; index?: number; sufficiency?: string }>();
  if (Array.isArray(categories)) {
    for (const c of categories) catMap.set(c.category, c);
  } else if (categories && typeof categories === "object") {
    for (const [cat, lvl] of Object.entries(categories)) {
      catMap.set(cat as RiskFactorCategory, { level: lvl });
    }
  }

  const heights = {
    sm: "h-3 text-[9px]",
    md: "h-4 text-[10px]",
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-1 rounded border border-outline-variant/30 bg-surface-container-low/50 p-0.5 ${className}`}
      role="group"
      aria-label="Category risk breakdown strip"
    >
      {ORDERED_CATEGORIES.map((cat) => {
        const item = catMap.get(cat);
        const level = (item?.level as keyof typeof LEVEL_CONFIG) ?? "NOT_ASSESSABLE";
        const config = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.NOT_ASSESSABLE;
        const categoryLabel = CATEGORY_LABELS[cat];

        return (
          <span
            key={cat}
            className={`inline-flex ${heights} min-w-[20px] items-center justify-center rounded px-1 font-mono font-bold transition-transform hover:scale-110 ${config.bgClass} text-white shadow-2xs`}
            title={`${categoryLabel}: ${config.label} (${item?.index ?? 0} pts, ${item?.sufficiency ?? "INSUFFICIENT"})`}
          >
            {SHORT_LABELS[cat]}
          </span>
        );
      })}
    </div>
  );
}
