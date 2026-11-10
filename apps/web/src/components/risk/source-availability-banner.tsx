"use client";

import { AlertTriangleIcon } from "lucide-react";
import type { RiskSourceFreshnessDto } from "@/lib/risk/types";

export function SourceAvailabilityBanner({
  sourceFreshness,
  className = "",
}: {
  sourceFreshness?: RiskSourceFreshnessDto[];
  className?: string;
}) {
  if (!sourceFreshness || sourceFreshness.length === 0) return null;

  const unavailable = sourceFreshness.filter((s) => !s.available);
  if (unavailable.length === 0) return null;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/90 p-4 text-amber-900 shadow-2xs dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 ${className}`}
    >
      <AlertTriangleIcon className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden="true" />
      <div className="space-y-1 text-sm">
        <p className="font-semibold">Partial Data Source Availability Notice</p>
        <p className="text-amber-800 dark:text-amber-300">
          Certain external subsystems are presently unavailable. Affected indicators operate in limited or non-assessable mode:
        </p>
        <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">
          {unavailable.map((s) => (
            <li key={s.source}>
              <span className="font-medium capitalize">{s.source}</span>: {s.reasonKey ?? "Source records unavailable"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
