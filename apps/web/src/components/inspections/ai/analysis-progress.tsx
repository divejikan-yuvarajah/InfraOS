"use client";

import { AlertTriangleIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";

import { getAiAdminCopy } from "@/lib/ai-admin/messages";
import { mapAiFailure } from "@/lib/ai-admin/view";
import type { AuthLocale } from "@/lib/auth/types";
import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";
import type { InspectionAiAnalysisView } from "@/lib/inspections/ai/types";

import { fill } from "@/lib/inspections/view";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

export function AnalysisProgress({
  analysis,
  copy,
  locale,
  onRetry,
  onContinueManually,
}: {
  analysis: InspectionAiAnalysisView;
  copy: InspectionAiMessages;
  locale: AuthLocale;
  onRetry?: () => void;
  onContinueManually?: () => void;
}) {
  const isFailed = analysis.status === "FAILED";
  const aiAdminCopy = getAiAdminCopy(locale);
  const failMessage = isFailed
    ? mapAiFailure(analysis.errorCode ? { code: analysis.errorCode } : undefined, aiAdminCopy, locale).message
    : "";

  return (
    <section
      className="ins-panel"
      role="status"
      aria-live="polite"
      aria-label={fill(copy.progress.analysisNo, { no: analysis.analysisNo })}
    >
      <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div className="ctr-row" style={{ gap: "0.5rem" }}>
          {isFailed ? (
            <AlertTriangleIcon aria-hidden="true" style={{ width: "1rem", height: "1rem", color: "#b91c1c" }} />
          ) : (
            <Loader2Icon aria-hidden="true" className="animate-spin" style={{ width: "1rem", height: "1rem" }} />
          )}
          <strong>{isFailed ? copy.progress.failedTitle : copy.progress.runningTitle}</strong>
        </div>
        <span className="ins-muted" style={{ fontSize: "0.82rem" }}>
          {fill(copy.progress.analysisNo, { no: analysis.analysisNo })} · {copy.status[analysis.status]}
        </span>
      </div>

      <p className="ins-muted" style={{ margin: "0.45rem 0 0", fontSize: "0.86rem" }}>
        {isFailed ? failMessage : copy.progress.runningBody}
      </p>

      {isFailed ? (
        <div className="ctr-row" style={{ gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
          {onRetry ? (
            <button type="button" className="ctr-btn is-primary" onClick={onRetry}>
              <RotateCcwIcon aria-hidden="true" />
              {copy.progress.failedRetry}
            </button>
          ) : null}
          {onContinueManually ? (
            <button type="button" className="ctr-btn is-ghost" onClick={onContinueManually}>
              {copy.picker.continueManually}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
