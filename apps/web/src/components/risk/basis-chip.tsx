"use client";

import type { RiskBasis } from "@/lib/risk/types";
import { BASIS_CONFIG } from "@/lib/risk/view";

export function BasisChip({
  basis,
  className = "",
}: {
  basis: RiskBasis;
  className?: string;
}) {
  const config = BASIS_CONFIG[basis] ?? BASIS_CONFIG.MIXED;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${config.badgeClass} ${className}`}
      title={`Grounding basis: ${config.label}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          config.isHollow ? "border border-current bg-transparent" : "bg-current"
        }`}
        aria-hidden="true"
      />
      <span>{config.label}</span>
    </span>
  );
}
