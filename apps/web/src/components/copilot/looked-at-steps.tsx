"use client";

import { AlertTriangleIcon, BanIcon, CheckCircle2Icon, SkipForwardIcon } from "lucide-react";

import type { CopilotMessages } from "@/lib/copilot/messages";
import { stepLabel } from "@/lib/copilot/poll";
import type { CopilotStepDto } from "@/lib/copilot/types";

function StepStatusBadge({ step, copy }: { step: CopilotStepDto; copy: CopilotMessages }) {
  if (step.status === "DENIED") {
    return (
      <span className="ctr-badge" data-tone="pending">
        <BanIcon aria-hidden="true" />
        {copy.answer.stepDenied}
      </span>
    );
  }
  if (step.status === "ERROR") {
    return (
      <span className="ctr-badge" data-tone="critical">
        <AlertTriangleIcon aria-hidden="true" />
        {copy.answer.stepError}
      </span>
    );
  }
  if (step.status === "SKIPPED") {
    return (
      <span className="ctr-badge" data-tone="neutral">
        <SkipForwardIcon aria-hidden="true" />
        {copy.answer.stepSkipped}
      </span>
    );
  }
  return (
    <span className="ctr-badge" data-tone="success">
      <CheckCircle2Icon aria-hidden="true" />
      {copy.answer.stepDone}
    </span>
  );
}

export function LookedAtSteps({
  steps,
  copy,
}: {
  steps: readonly CopilotStepDto[];
  copy: CopilotMessages;
}) {
  if (steps.length === 0) return null;

  return (
    <details className="ai-about">
      <summary>{copy.answer.lookedAt.replace("{n}", String(steps.length))}</summary>
      <ol className="cop-steps" style={{ marginTop: "0.4rem" }}>
        {steps.map((step, i) => (
          <li key={`${step.at}-${i}`} className="cop-step" data-status={step.status}>
            <span className="cop-step-main">
              <span>{stepLabel(step, copy)}</span>
            </span>
            <span className="ctr-row" style={{ gap: "0.35rem" }}>
              <StepStatusBadge step={step} copy={copy} />
              {step.durationMs > 0 ? (
                <span className="ctr-muted ctr-num" style={{ fontSize: "0.7rem" }}>
                  {step.durationMs} ms
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
