"use client";

import type { RiskSufficiency } from "@/lib/risk/types";
import { SUFFICIENCY_CONFIG } from "@/lib/risk/view";

export function SufficiencyChip({
  sufficiency,
  className = "",
}: {
  sufficiency: RiskSufficiency;
  className?: string;
}) {
  const config = SUFFICIENCY_CONFIG[sufficiency] ?? SUFFICIENCY_CONFIG.SUFFICIENT;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums ${config.badgeClass} ${className}`}
      title={`Data sufficiency: ${config.label}`}
    >
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((pip) => (
          <span
            key={pip}
            className={`inline-block size-1.5 rounded-full ${
              pip <= config.pips ? "bg-current opacity-90" : "bg-current opacity-25"
            }`}
          />
        ))}
      </span>
      <span>{config.label}</span>
    </span>
  );
}
