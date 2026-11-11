"use client";

import { CheckIcon, FilePlus2Icon, SlashIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { submitVisionReview } from "@/lib/inspections/ai/api";
import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";
import type { InspectionAiAnalysisView, InspectorDecision } from "@/lib/inspections/ai/types";
import { reviewableItemsOf, reviewProgressOf } from "@/lib/inspections/ai/view";
import { fill } from "@/lib/inspections/view";

import { Chip } from "../inspection-ui";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

type DecisionEntry = { decision: InspectorDecision; comment?: string };

const DECISION_OPTIONS: Array<{
  value: InspectorDecision;
  icon: typeof CheckIcon;
}> = [
  { value: "CONFIRMED", icon: CheckIcon },
  { value: "DISPUTED", icon: XIcon },
  { value: "NOT_RELEVANT", icon: SlashIcon },
];

export function InspectorReviewControls({
  inspectionId,
  analysis,
  copy,
  canInsert,
  onSaved,
  onOpenInsert,
}: {
  inspectionId: string;
  analysis: InspectionAiAnalysisView;
  copy: InspectionAiMessages;
  canInsert: boolean;
  onSaved: (updated: InspectionAiAnalysisView) => void;
  onOpenInsert?: () => void;
}) {
  const [decisions, setDecisions] = useState<Record<string, DecisionEntry>>(
    () => ({ ...(analysis.inspectorReview?.decisions ?? {}) }),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => reviewableItemsOf(analysis.result, copy), [analysis.result, copy]);
  const progress = useMemo(
    () => reviewProgressOf(analysis, decisions, copy),
    [analysis, decisions, copy],
  );

  const savedConfirmedCount = useMemo(() => {
    const saved = analysis.inspectorReview?.decisions ?? {};
    return Object.values(saved).filter((d) => d.decision === "CONFIRMED").length;
  }, [analysis.inspectorReview?.decisions]);

  const hasLocalDecisions = Object.keys(decisions).length > 0;
  const hasUnsavedChanges = useMemo(() => {
    const saved = analysis.inspectorReview?.decisions ?? {};
    const keys = new Set([...Object.keys(saved), ...Object.keys(decisions)]);
    for (const k of keys) {
      if (saved[k]?.decision !== decisions[k]?.decision) return true;
      if ((saved[k]?.comment ?? "") !== (decisions[k]?.comment ?? "")) return true;
    }
    return false;
  }, [analysis.inspectorReview?.decisions, decisions]);

  const setItemDecision = (key: string, decision: InspectorDecision) => {
    setError(null);
    setDecisions((prev) => ({
      ...prev,
      [key]: { decision, comment: prev[key]?.comment },
    }));
  };

  const setItemComment = (key: string, comment: string) => {
    setDecisions((prev) => {
      const current = prev[key];
      if (!current) return prev;
      return {
        ...prev,
        [key]: { ...current, comment },
      };
    });
  };

  const handleSave = async () => {
    if (!hasLocalDecisions || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payloadDecisions: Record<string, DecisionEntry> = {};
      for (const [k, v] of Object.entries(decisions)) {
        const trimmed = v.comment?.trim();
        payloadDecisions[k] = trimmed ? { decision: v.decision, comment: trimmed } : { decision: v.decision };
      }
      const updated = await submitVisionReview(inspectionId, analysis.id, {
        decisions: payloadDecisions,
      });
      toast.success(copy.review.savedToast);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review decisions.");
    } finally {
      setSaving(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <section className="ins-panel" aria-label={copy.review.title}>
      <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <h4 className="ins-h" style={{ margin: 0 }}>{copy.review.title}</h4>
        <Chip tone={analysis.inspectorReview.status === "REVIEWED" ? "success" : "pending"}>
          {fill(copy.review.progressCount, {
            reviewed: progress.reviewedCount,
            total: progress.totalCount,
          })}
        </Chip>
      </div>

      {analysis.inspectorReview.status === "PENDING" ? (
        <div
          className="ai-limit-banner"
          data-tone="warning"
          role="status"
          style={{ marginBottom: "0.75rem", fontSize: "0.85rem" }}
        >
          {copy.review.pendingBanner}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: "0.65rem" }}>
        {items.map((item) => {
          const entry = decisions[item.key];
          return (
            <div
              key={item.key}
              className="ins-ai-obs"
              data-decision={entry?.decision ?? ""}
              style={{ display: "grid", gap: "0.4rem" }}
            >
              <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                <strong style={{ fontSize: "0.86rem" }}>{item.label}</strong>
                <div className="ctr-row" role="group" aria-label={item.label} style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                  {DECISION_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = entry?.decision === opt.value;
                    const label =
                      opt.value === "CONFIRMED"
                        ? copy.review.confirm
                        : opt.value === "DISPUTED"
                          ? copy.review.dispute
                          : copy.review.notRelevant;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={active ? "ctr-btn is-primary" : "ctr-btn"}
                        aria-pressed={active}
                        disabled={saving}
                        onClick={() => setItemDecision(item.key, opt.value)}
                      >
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="ins-muted" style={{ margin: 0, fontSize: "0.82rem" }}>{item.previewText}</p>

              {entry ? (
                <input
                  type="text"
                  className="ctr-input"
                  maxLength={300}
                  value={entry.comment ?? ""}
                  onChange={(e) => setItemComment(item.key, e.target.value)}
                  placeholder={copy.review.commentPlaceholder}
                  aria-label={`${item.label} — ${copy.review.commentPlaceholder}`}
                  disabled={saving}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="ctr-error" role="alert" style={{ marginTop: "0.5rem" }}>{error}</p>
      ) : null}

      <div className="ctr-row" style={{ gap: "0.6rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="ctr-btn is-primary"
          disabled={!hasLocalDecisions || saving}
          onClick={() => void handleSave()}
        >
          {saving ? copy.review.savingReview : copy.review.saveReview}
        </button>

        {canInsert && onOpenInsert ? (
          <button
            type="button"
            className="ctr-btn"
            disabled={savedConfirmedCount === 0 || hasUnsavedChanges || saving}
            onClick={onOpenInsert}
          >
            <FilePlus2Icon aria-hidden="true" />
            <span>{fill(copy.review.openInsertDialog, { n: savedConfirmedCount })}</span>
          </button>
        ) : null}
      </div>

      {canInsert && (savedConfirmedCount === 0 || hasUnsavedChanges) ? (
        <p className="ins-muted" style={{ margin: "0.4rem 0 0", fontSize: "0.8rem" }}>
          {copy.review.nothingConfirmed}
        </p>
      ) : null}
    </section>
  );
}
