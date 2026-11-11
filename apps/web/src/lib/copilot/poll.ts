import type { CopilotMessages } from "./messages-en";
import type { CopilotStepDto, CopilotTurnStatus } from "./types";

const TERMINAL_STATUSES = new Set<CopilotTurnStatus>([
  "ANSWERED",
  "PARTIAL",
  "INSUFFICIENT_EVIDENCE",
  "FAILED",
  "CANCELLED",
  "BLOCKED_BY_POLICY",
]);

export const MAX_POLL_ELAPSED_MS = 90_000;

export function isTerminalCopilotStatus(status: CopilotTurnStatus | string | undefined): boolean {
  return Boolean(status && TERMINAL_STATUSES.has(status as CopilotTurnStatus));
}

/**
 * Adaptive polling cadence with backoff and tab-visibility pause:
 * - Returns `false` when tab is hidden or elapsed window (>= 90s) is exhausted.
 * - 600ms initially -> 900ms after 6s -> 1200ms after 25s.
 */
export function pollDelayMs(elapsedMs: number, isTabVisible = true): number | false {
  if (!isTabVisible) return false;
  if (elapsedMs >= MAX_POLL_ELAPSED_MS) return false;
  if (elapsedMs < 6_000) return 600;
  if (elapsedMs < 25_000) return 900;
  return 1_200;
}

export function formatElapsed(elapsedMs: number, copy: CopilotMessages): string {
  const sec = Math.max(0, Math.floor(elapsedMs / 1000));
  if (sec < 60) return copy.elapsedSeconds.replace("{s}", String(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return copy.elapsedMinutes.replace("{m}", String(m)).replace("{s}", String(s));
}

export function stepLabel(step: CopilotStepDto, copy: CopilotMessages): string {
  const map = copy.steps as Record<string, string>;
  if (step.labelKey && map[step.labelKey]) {
    return map[step.labelKey]!;
  }
  if (step.tool && map[`copilot.step.${step.tool}`]) {
    return map[`copilot.step.${step.tool}`]!;
  }
  if (step.status === "DENIED") return copy.steps["copilot.step.permission_denied"];
  if (step.status === "ERROR") return copy.steps["copilot.step.service_unavailable"];
  return copy.steps["copilot.step.evaluating_tools"];
}

