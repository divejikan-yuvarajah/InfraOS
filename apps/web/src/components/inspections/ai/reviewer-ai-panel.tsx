"use client";

import { useState } from "react";

import type { AiLimitsMeDto } from "@/lib/ai-admin/types";
import type { AuthLocale } from "@/lib/auth/types";
import { requestVisionAnalysis } from "@/lib/inspections/ai/api";
import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";
import type { InspectionAiAnalysisView, VisionEligibilityDto } from "@/lib/inspections/ai/types";
import { reviewableItemsOf } from "@/lib/inspections/ai/view";
import type { Copy as InspectionCopy } from "@/lib/inspections/messages";
import type { EvidenceItem } from "@/lib/inspections/types";
import { fill, fmtDateTime } from "@/lib/inspections/view";

import { Chip } from "../inspection-ui";
import { AiLimitations } from "./ai-limitations";
import { AnalysisProgress } from "./analysis-progress";
import { CostEstimate } from "./cost-estimate";
import { EvidencePicker } from "./evidence-picker";
import { AnalysisPhotoDialog, AnalysisResultSections } from "./observation-card";
import { ProviderNoticeDialog } from "./provider-notice-dialog";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

export function ReviewerAiPanel({
  inspectionId,
  evidence,
  eligibility,
  analyses,
  limits,
  aiCopy,
  inspectionCopy,
  locale,
  onAnalysisCreated,
  onRefresh,
}: {
  inspectionId: string;
  evidence: EvidenceItem[];
  eligibility: VisionEligibilityDto | null;
  analyses: InspectionAiAnalysisView[];
  limits: AiLimitsMeDto | null;
  aiCopy: InspectionAiMessages;
  inspectionCopy: InspectionCopy;
  locale: AuthLocale;
  onAnalysisCreated?: (created: InspectionAiAnalysisView) => void;
  onRefresh?: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    (eligibility?.selectableEvidence ?? []).slice(0, eligibility?.maxImages ?? 6).map((e) => e.evidenceId),
  );
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lightboxState, setLightboxState] = useState<{ analysis: InspectionAiAnalysisView; photoNumber: number } | null>(null);

  const activeEvidenceIds = new Set(evidence.filter((e) => e.status === "ACTIVE").map((e) => e.id));
  const maxImages = eligibility?.maxImages ?? 6;
  const canRunSecondLook = Boolean(
    eligibility?.visionEnabled &&
      eligibility.eligible &&
      eligibility.role === "REVIEWER" &&
      eligibility.selectableEvidence.length > 0,
  );

  const toggleEvidence = (evidenceId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(evidenceId)) return prev.filter((id) => id !== evidenceId);
      if (prev.length >= maxImages) return prev;
      return [...prev, evidenceId];
    });
  };

  const handleConfirmSecondLook = async () => {
    if (selectedIds.length === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await requestVisionAnalysis(inspectionId, {
        evidenceIds: selectedIds,
        acknowledgedProvider: true,
      });
      setNoticeOpen(false);
      onAnalysisCreated?.(created);
      onRefresh?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not start second-look analysis.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="ins-ai-advisory" aria-label={aiCopy.reviewerPanel.title}>
      <div className="ins-ai-advisory-banner">
        <strong>{aiCopy.advisoryBanner}</strong>
        <span>{aiCopy.advisoryNote}</span>
      </div>

      <div>
        <h3 className="ins-h" style={{ marginBottom: "0.25rem" }}>{aiCopy.reviewerPanel.title}</h3>
        <p className="ins-muted" style={{ margin: 0, fontSize: "0.86rem" }}>
          {aiCopy.reviewerPanel.subtitle}
        </p>
      </div>

      {analyses.length === 0 ? (
        <p className="ins-muted" style={{ margin: 0, fontSize: "0.86rem" }}>
          {aiCopy.reviewerPanel.noAnalyses}
        </p>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {analyses.map((analysis) => {
            const items = reviewableItemsOf(analysis.result, aiCopy);
            const decisions = analysis.inspectorReview?.decisions ?? {};

            return (
              <article key={analysis.id} className="ins-panel" style={{ display: "grid", gap: "0.75rem" }}>
                <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div className="ctr-row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
                    <strong>{analysis.analysisNo}</strong>
                    <Chip tone="neutral">
                      {fill(aiCopy.reviewerPanel.roleRequested, { role: analysis.requestedByRole })}
                    </Chip>
                    {analysis.supersededBy ? (
                      <Chip tone="pending">{aiCopy.status.SUPERSEDED}</Chip>
                    ) : null}
                  </div>
                  <div className="ctr-row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
                    <Chip tone={analysis.inspectorReview.status === "REVIEWED" ? "success" : "pending"}>
                      {fill(aiCopy.reviewerPanel.inspectorStatus, {
                        status:
                          analysis.inspectorReview.status === "REVIEWED"
                            ? aiCopy.status.REVIEWED
                            : aiCopy.status.PENDING_REVIEW,
                      })}
                    </Chip>
                    <span className="ins-muted" style={{ fontSize: "0.8rem" }}>
                      {fmtDateTime(analysis.createdAt, locale)}
                    </span>
                  </div>
                </div>

                {analysis.status === "QUEUED" || analysis.status === "RUNNING" || analysis.status === "FAILED" ? (
                  <AnalysisProgress analysis={analysis} copy={aiCopy} locale={locale} />
                ) : (
                  <>
                    <AnalysisResultSections
                      analysis={analysis}
                      aiCopy={aiCopy}
                      onOpenPhoto={(n) => setLightboxState({ analysis, photoNumber: n })}
                    />

                    {items.length > 0 ? (
                      <div className="ins-panel" style={{ display: "grid", gap: "0.35rem", fontSize: "0.84rem" }}>
                        <strong>{aiCopy.review.title}</strong>
                        {items.map((item) => {
                          const entry = decisions[item.key];
                          return (
                            <div
                              key={item.key}
                              className="ctr-row"
                              style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}
                            >
                              <span>
                                <strong>{item.label}</strong>
                                {entry?.comment ? ` — ${entry.comment}` : ""}
                              </span>
                              <Chip
                                tone={
                                  entry?.decision === "CONFIRMED"
                                    ? "success"
                                    : entry?.decision === "DISPUTED"
                                      ? "critical"
                                      : "neutral"
                                }
                              >
                                {entry
                                  ? aiCopy.review.decisions[entry.decision]
                                  : aiCopy.status.PENDING_REVIEW}
                              </Chip>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      {canRunSecondLook && eligibility ? (
        <section className="ins-panel" style={{ display: "grid", gap: "0.75rem" }}>
          <h4 className="ins-h" style={{ margin: 0 }}>{aiCopy.picker.runSecondLook}</h4>
          <EvidencePicker
            selectableEvidence={eligibility.selectableEvidence}
            selectedIds={selectedIds}
            maxImages={maxImages}
            qualityPreview={eligibility.qualityPreview}
            onToggle={toggleEvidence}
            aiCopy={aiCopy}
            inspectionCopy={inspectionCopy}
            disabled={submitting}
          />
          <CostEstimate
            selectedCount={selectedIds.length}
            maxImages={maxImages}
            estimatedCostUnits={Math.max(1, selectedIds.length)}
            limits={limits}
            copy={aiCopy}
          />
          {submitError ? (
            <p className="ctr-error" role="alert" style={{ margin: 0 }}>{submitError}</p>
          ) : null}
          <div>
            <button
              type="button"
              className="ctr-btn is-primary"
              disabled={selectedIds.length === 0 || submitting}
              onClick={() => setNoticeOpen(true)}
            >
              {aiCopy.picker.runSecondLook}
            </button>
          </div>
          <ProviderNoticeDialog
            open={noticeOpen}
            photoCount={selectedIds.length}
            copy={aiCopy}
            busy={submitting}
            onOpenChange={setNoticeOpen}
            onConfirm={() => void handleConfirmSecondLook()}
          />
        </section>
      ) : null}

      <AiLimitations copy={aiCopy} />

      {lightboxState ? (
        <AnalysisPhotoDialog
          analysis={lightboxState.analysis}
          photoNumber={lightboxState.photoNumber}
          activeEvidenceIds={activeEvidenceIds}
          aiCopy={aiCopy}
          inspectionCopy={inspectionCopy}
          onClose={() => setLightboxState(null)}
        />
      ) : null}
    </section>
  );
}
