"use client";

import "@/styles/ai-copilot.css";
import "@/styles/contractors.css";

export function BudgetGauge({
  label,
  used,
  limit,
  softPct,
  unit = "",
}: {
  label: string;
  used: number;
  limit: number;
  softPct?: number;
  unit?: string;
}) {
  const safeLimit = Math.max(1, limit);
  const pct = Math.min(100, Math.round((used / safeLimit) * 100));
  const tier: "normal" | "soft" | "hard" =
    used >= limit ? "hard" : softPct !== undefined && pct >= softPct ? "soft" : "normal";

  const formatNum = (n: number) => new Intl.NumberFormat().format(Math.round(n));

  return (
    <div className="gov-gauge">
      <div className="ctr-row" style={{ justifyContent: "space-between", fontSize: "0.84rem" }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span>
          {formatNum(used)} / {formatNum(limit)}
          {unit ? ` ${unit}` : ""} ({pct}%)
        </span>
      </div>
      <div
        className="gov-gauge-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="gov-gauge-fill"
          data-tier={tier}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

