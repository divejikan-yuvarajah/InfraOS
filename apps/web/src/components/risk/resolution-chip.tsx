"use client";

import type { RiskResolutionStatus } from "@/lib/risk/types";
import { RESOLUTION_CONFIG } from "@/lib/risk/view";

export function ResolutionChip({
  status,
  isReopened,
  className = "",
}: {
  status: RiskResolutionStatus;
  isReopened?: boolean;
  className?: string;
}) {
  const key = isReopened ? "REOPENED" : status;
  const config = RESOLUTION_CONFIG[key] ?? RESOLUTION_CONFIG.OPEN;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-tight ${config.badgeClass} ${className}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
