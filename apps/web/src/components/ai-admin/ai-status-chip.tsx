"use client";

import Link from "next/link";

import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import { fillTemplate } from "@/lib/ai-admin/view";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { useAiStatus } from "./ai-status-provider";
import "@/styles/ai-copilot.css";

export function AiStatusChip() {
  const { canAccessAi, overall, status } = useAiStatus();
  const [locale] = useWorkspaceLocale();

  if (!canAccessAi) return null;

  const copy = getAiAdminCopy(locale);
  const allDisabled =
    status !== null &&
    Object.values(status.features).length > 0 &&
    Object.values(status.features).every((s) => s === "disabled");

  const state: "available" | "degraded" | "unavailable" | "disabled" = allDisabled
    ? "disabled"
    : overall;

  const label = copy.chip[state];

  return (
    <Link
      href="/settings/ai"
      className="ai-status-chip"
      data-state={state}
      aria-label={fillTemplate(copy.chip.ariaLabel, { state: label })}
      title={label}
    >
      <span className="ai-status-dot" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

