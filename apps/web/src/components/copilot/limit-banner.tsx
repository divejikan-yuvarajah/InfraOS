"use client";

import { AlertTriangleIcon, ClockIcon, ShieldAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import { fillTemplate, formatCountdownSeconds, formatDateTime } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";

import "@/styles/contractors.css";

export function LimitBanner({
  kind,
  locale,
  untilMs,
  resetsAt,
  messageOverride,
  action,
}: {
  kind: "rate_limited" | "budget_exceeded" | "degraded" | "disabled" | "unavailable";
  locale: AuthLocale;
  untilMs?: number | null;
  resetsAt?: string;
  messageOverride?: string;
  action?: React.ReactNode;
}) {
  const copy = getAiAdminCopy(locale);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (kind !== "rate_limited" || !untilMs) return;
    const t0 = window.setTimeout(() => setNowMs(Date.now()), 0);
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(id);
    };
  }, [kind, untilMs]);

  const remaining = untilMs ? Math.max(0, Math.ceil((untilMs - nowMs) / 1000)) : 60;

  const tone =
    kind === "rate_limited" || kind === "budget_exceeded" || kind === "unavailable" || kind === "disabled"
      ? "critical"
      : "warning";

  const Icon =
    kind === "rate_limited"
      ? ClockIcon
      : kind === "disabled" || kind === "unavailable"
        ? ShieldAlertIcon
        : AlertTriangleIcon;

  const text =
    messageOverride ??
    (kind === "rate_limited"
      ? fillTemplate(copy.failures.AI_RATE_LIMITED, { countdown: formatCountdownSeconds(remaining, copy) })
      : kind === "budget_exceeded"
        ? fillTemplate(copy.failures.AI_BUDGET_EXCEEDED, {
            reset: resetsAt ? formatDateTime(resetsAt, locale) : "00:00",
          })
        : kind === "disabled"
          ? copy.failures.FEATURE_DISABLED
          : copy.failures.AI_UNAVAILABLE);

  return (
    <div className="ai-limit-banner" data-tone={tone} role="status" aria-live="polite">
      <span className="ctr-row" style={{ gap: "0.45rem" }}>
        <Icon aria-hidden="true" style={{ width: "1rem", height: "1rem", flex: "none" }} />
        <span>{text}</span>
      </span>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
