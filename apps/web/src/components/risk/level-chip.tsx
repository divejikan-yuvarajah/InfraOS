"use client";

import type { RiskLevel } from "@/lib/risk/types";
import { LEVEL_CONFIG } from "@/lib/risk/view";

export function LevelChip({
  level,
  showGlyph = true,
  size = "md",
  className = "",
}: {
  level: RiskLevel;
  showGlyph?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const config = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.NOT_ASSESSABLE;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tabular-nums tracking-wide shadow-2xs ${sizeClasses} ${config.badgeClass} ${className}`}
      aria-label={`Risk level: ${config.label}`}
    >
      {showGlyph ? (
        <span className="font-bold text-[12px] leading-none" aria-hidden="true">
          {config.glyph}
        </span>
      ) : null}
      <span>{config.label}</span>
    </span>
  );
}
