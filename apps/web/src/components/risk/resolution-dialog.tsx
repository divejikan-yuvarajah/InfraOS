"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import type { RiskIndicatorDto, RiskResolutionDto, RiskResolutionStatus } from "@/lib/risk/types";
import { updateProjectResolution } from "@/lib/risk/api";

const STATUS_OPTIONS: Array<{ value: RiskResolutionStatus; label: string; description: string }> = [
  {
    value: "OPEN",
    label: "Unacknowledged (Open)",
    description: "Active indicator pending initial management triage.",
  },
  {
    value: "ACKNOWLEDGED",
    label: "Acknowledge Risk",
    description: "Risk noted by project management; under evaluation.",
  },
  {
    value: "IN_PROGRESS",
    label: "Mitigation In Progress",
    description: "Operational or contractual corrective actions underway.",
  },
  {
    value: "RESOLVED",
    label: "Mark as Resolved",
    description: "Mitigation completed or underlying constraint verified rectified.",
  },
  {
    value: "DISMISSED",
    label: "Dismiss (Justified Exception)",
    description: "Documented acceptable variance or approved statutory waiver.",
  },
];

export function ResolutionDialog({
  projectId,
  indicator,
  existingResolution,
  assessmentId,
  onClose,
  onSaved,
}: {
  projectId: string;
  indicator: RiskIndicatorDto;
  existingResolution?: RiskResolutionDto | null;
  assessmentId?: string;
  onClose: () => void;
  onSaved: (updated: RiskResolutionDto) => void;
}) {
  const [status, setStatus] = useState<RiskResolutionStatus>(
    existingResolution?.status ?? "ACKNOWLEDGED",
  );
  const [note, setNote] = useState(existingResolution?.note ?? "");
  const [reviewAt, setReviewAt] = useState(
    existingResolution?.reviewAt ? existingResolution.reviewAt.slice(0, 10) : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isRequiresLongNote = status === "RESOLVED" || status === "DISMISSED";
  const isValidNote = isRequiresLongNote ? note.trim().length >= 12 : true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidNote) {
      setErrorMsg("A detailed justification note (at least 12 characters) is required for Resolved and Dismissed states.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await updateProjectResolution(projectId, indicator.fingerprint, {
        status,
        note: note.trim(),
        version: existingResolution?.version ?? 0,
        assessmentId,
        reviewAt: reviewAt ? new Date(reviewAt).toISOString() : undefined,
      });

      onSaved(res.resolution);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message ?? "Failed to update risk triage status. Check permissions or concurrency.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-labelledby="resolution-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div>
            <span className="font-mono text-xs font-bold text-infra-orange">
              {indicator.code} · {indicator.fingerprint}
            </span>
            <h3 id="resolution-dialog-title" className="text-base font-semibold text-text-primary">
              Update Risk Triage Status
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:text-text-primary"
            aria-label="Close dialog"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {errorMsg ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {errorMsg}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Status radio select */}
          <div className="space-y-2">
            <label className="font-semibold text-text-secondary block">
              Triage Status
            </label>
            <div className="space-y-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                    status === opt.value
                      ? "border-infra-orange bg-orange-50/50 dark:bg-orange-950/20"
                      : "border-border hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="radio"
                    name="resolution_status"
                    value={opt.value}
                    checked={status === opt.value}
                    onChange={() => setStatus(opt.value)}
                    className="mt-0.5 text-infra-orange focus:ring-ring"
                  />
                  <div>
                    <span className="font-semibold text-text-primary block">
                      {opt.label}
                    </span>
                    <span className="text-text-muted text-[11px]">
                      {opt.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Action note */}
          <div className="space-y-1">
            <label htmlFor="resolution-note" className="font-semibold text-text-secondary block">
              Action Note / Justification {isRequiresLongNote ? <span className="text-rose-600">* (min 12 chars)</span> : null}
            </label>
            <textarea
              id="resolution-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Document investigation findings, operational mitigation actions, or justification for waiver…"
              className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-[11px] text-text-muted">
              {note.trim().length} / 1000 characters
            </p>
          </div>

          {/* Revisit Date */}
          <div className="space-y-1">
            <label htmlFor="resolution-review-at" className="font-semibold text-text-secondary block">
              Follow-up Revisit Date (Optional)
            </label>
            <input
              id="resolution-review-at"
              type="date"
              value={reviewAt}
              onChange={(e) => setReviewAt(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-[10px] text-text-muted">
              If an indicator remains active past this date, triage status automatically reopens.
            </p>
          </div>

          <p className="text-[11px] text-text-muted italic border-t border-border/30 pt-2">
            Governance Note: Team triage actions are recorded in the audit ledger and do not alter underlying rule points or calculations.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-container-low"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-infra-orange px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              {isSubmitting ? "Saving Status…" : "Save Triage Status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
