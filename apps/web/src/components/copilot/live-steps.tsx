"use client";

import { AlertTriangleIcon, BanIcon, CheckCircle2Icon, Loader2Icon, SquareIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { CopilotMessages } from "@/lib/copilot/messages";
import { formatElapsed, stepLabel } from "@/lib/copilot/poll";
import type { CopilotStepDto } from "@/lib/copilot/types";

export function LiveSteps({
  steps,
  startedAtMs,
  cancelling,
  timedOut,
  onCancel,
  onRefresh,
  copy,
}: {
  steps: readonly CopilotStepDto[];
  startedAtMs: number;
  cancelling: boolean;
  timedOut: boolean;
  onCancel: () => void;
  onRefresh: () => void;
  copy: CopilotMessages;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, nowMs - startedAtMs);

  return (
    <section className="ai-evidence" aria-label={copy.status.RUNNING} role="status" aria-live="polite">
      <div className="ctr-bar" style={{ padding: "0.55rem 0.7rem" }}>
        <span className="ctr-row" style={{ gap: "0.45rem" }}>
          <Loader2Icon aria-hidden="true" className="animate-spin" style={{ width: "1rem", height: "1rem" }} />
          <strong style={{ fontSize: "0.85rem" }}>{copy.answer.waitingRunning}</strong>
        </span>
        <span className="ctr-row" style={{ gap: "0.45rem" }}>
          <span className="ctr-muted ctr-num" style={{ fontSize: "0.78rem" }}>
            {formatElapsed(elapsedMs, copy)}
          </span>
          <button
            type="button"
            className="ctr-btn"
            style={{ minHeight: "2rem", padding: "0.2rem 0.65rem", fontSize: "0.78rem" }}
            disabled={cancelling}
            onClick={onCancel}
          >
            <SquareIcon aria-hidden="true" style={{ width: "0.75rem", height: "0.75rem" }} />
            <span>{cancelling ? copy.composer.cancelling : copy.composer.stop}</span>
          </button>
        </span>
      </div>

      <ol className="cop-steps" style={{ padding: "0 0.7rem 0.65rem" }}>
        {steps.length === 0 ? (
          <li className="cop-step">
            <span className="cop-step-main">
              <Loader2Icon aria-hidden="true" className="animate-spin" style={{ width: "0.85rem", height: "0.85rem" }} />
              <span>{copy.steps["copilot.step.evaluating_tools"]}</span>
            </span>
          </li>
        ) : (
          steps.map((step, i) => (
            <li key={`${step.at}-${i}`} className="cop-step" data-status={step.status}>
              <span className="cop-step-main">
                {step.status === "DENIED" ? (
                  <BanIcon aria-hidden="true" style={{ width: "0.85rem", height: "0.85rem", color: "var(--infra-yellow-text)" }} />
                ) : step.status === "ERROR" ? (
                  <AlertTriangleIcon aria-hidden="true" style={{ width: "0.85rem", height: "0.85rem", color: "var(--infra-critical-text)" }} />
                ) : (
                  <CheckCircle2Icon aria-hidden="true" style={{ width: "0.85rem", height: "0.85rem", color: "var(--infra-green-text)" }} />
                )}
                <span>{stepLabel(step, copy)}</span>
              </span>
              {step.durationMs > 0 ? (
                <span className="ctr-muted ctr-num" style={{ fontSize: "0.7rem" }}>
                  {step.durationMs} ms
                </span>
              ) : null}
            </li>
          ))
        )}
      </ol>

      {timedOut ? (
        <div className="ctr-bar" style={{ padding: "0.5rem 0.7rem", borderTop: "1px solid var(--infra-border)" }}>
          <span className="ctr-small">{copy.answer.pollTimeoutNotice}</span>
          <button type="button" className="ctr-btn" onClick={onRefresh}>
            {copy.answer.retry}
          </button>
        </div>
      ) : null}
    </section>
  );
}
