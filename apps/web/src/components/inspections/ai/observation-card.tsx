"use client";

import { EyeIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";
import type {
  InspectionAiAnalysisView,
  InspectorDecision,
  VisionImageResult,
} from "@/lib/inspections/ai/types";
import type { Copy as InspectionCopy } from "@/lib/inspections/messages";
import { fill } from "@/lib/inspections/view";

import { AuthedImage, Chip } from "../inspection-ui";
import { ConsistencyChip } from "./consistency-chip";
import { DiscrepancyList } from "./discrepancy-list";
import { QualityChecksTable } from "./quality-checks-table";
import { UncertaintyPanel } from "./uncertainty-panel";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

export function ObservationCard({
  image,
  decision,
  copy,
  onOpenPhoto,
}: {
  image: VisionImageResult;
  decision?: InspectorDecision;
  copy: InspectionAiMessages;
  onOpenPhoto?: (photoNumber: number) => void;
}) {
  const photoTitle = fill(copy.results.photoLabel, { n: image.n });

  return (
    <article
      className="ins-ai-obs"
      data-decision={decision ?? ""}
      aria-label={photoTitle}
    >
      <div className="ctr-row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.35rem" }}>
        <div className="ctr-row" style={{ gap: "0.45rem" }}>
          {onOpenPhoto ? (
            <button
              type="button"
              className="ctr-btn is-ghost"
              onClick={() => onOpenPhoto(image.n)}
              aria-label={fill(copy.results.openPhoto, { n: image.n })}
            >
              <EyeIcon aria-hidden="true" />
              <span>{photoTitle}</span>
            </button>
          ) : (
            <strong>{photoTitle}</strong>
          )}
          {decision ? (
            <Chip tone={decision === "CONFIRMED" ? "success" : decision === "DISPUTED" ? "critical" : "neutral"}>
              {copy.review.decisions[decision]}
            </Chip>
          ) : null}
        </div>

        {image.qualityIssues.length > 0 ? (
          <div className="ctr-row" style={{ gap: "0.3rem", flexWrap: "wrap" }}>
            {image.qualityIssues.map((q) => (
              <span key={q} className="ins-badge" data-t="site-away">
                {copy.results.qualityIssues[q] ?? q}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <p style={{ margin: "0 0 0.4rem", fontSize: "0.9rem" }}>{image.activityDescription}</p>

      {image.visibleWorkIndicators.length > 0 ? (
        <div className="ctr-row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
          {image.visibleWorkIndicators.map((ind, idx) => (
            <span
              key={`${ind.label}-${idx}`}
              className="ins-badge"
              data-t={ind.certainty === "CLEAR" ? "site-on" : "site"}
            >
              {ind.label} ({copy.results.certainty[ind.certainty] ?? ind.certainty})
            </span>
          ))}
        </div>
      ) : (
        <p className="ins-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
          {copy.results.noVisibleIndicators}
        </p>
      )}

      {image.notes ? (
        <p className="ins-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.83rem" }}>{image.notes}</p>
      ) : null}
    </article>
  );
}

export function AnalysisPhotoDialog({
  analysis,
  photoNumber,
  activeEvidenceIds,
  aiCopy,
  inspectionCopy,
  onClose,
}: {
  analysis: InspectionAiAnalysisView;
  photoNumber: number | null;
  activeEvidenceIds: Set<string>;
  aiCopy: InspectionAiMessages;
  inspectionCopy: InspectionCopy;
  onClose: () => void;
}) {
  const ev = photoNumber !== null ? analysis.evidence[photoNumber - 1] : undefined;
  const stillPresent = Boolean(ev && activeEvidenceIds.has(ev.evidenceId));
  const title = photoNumber !== null ? fill(aiCopy.results.photoLabel, { n: photoNumber }) : "";

  return (
    <Dialog open={photoNumber !== null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-2xl ctr-dialog max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {fill(aiCopy.progress.analysisNo, { no: analysis.analysisNo })}
          </DialogDescription>
        </DialogHeader>
        {ev ? (
          stillPresent ? (
            <div style={{ width: "100%", height: "55vh" }}>
              <AuthedImage
                key={ev.evidenceId}
                evidenceId={ev.evidenceId}
                variant="full"
                alt={title}
                copy={inspectionCopy}
                eager
              />
            </div>
          ) : (
            <p className="ins-muted" style={{ padding: "1rem 0" }}>
              {inspectionCopy.evidence.removed}
            </p>
          )
        ) : (
          <p className="ins-muted" style={{ padding: "1rem 0" }}>
            {inspectionCopy.evidence.loadError}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AnalysisResultSections({
  analysis,
  aiCopy,
  decisionOverrides,
  onOpenPhoto,
}: {
  analysis: InspectionAiAnalysisView;
  aiCopy: InspectionAiMessages;
  decisionOverrides?: Record<string, { decision: InspectorDecision; comment?: string }>;
  onOpenPhoto?: (photoNumber: number) => void;
}) {
  const indexMap = new Map<string, number>();
  analysis.evidence.forEach((ev, idx) => indexMap.set(ev.evidenceId, idx + 1));

  const res = analysis.result;
  const decisions = decisionOverrides ?? analysis.inspectorReview?.decisions ?? {};

  return (
    <div style={{ display: "grid", gap: "0.85rem" }}>
      <QualityChecksTable
        qualityChecks={analysis.qualityChecks}
        copy={aiCopy}
        evidenceIndexById={indexMap}
      />

      {res ? (
        <>
          <section className="ins-panel" aria-label={aiCopy.results.visibleTitle}>
            <h4 className="ins-h" style={{ marginBottom: "0.55rem" }}>{aiCopy.results.visibleTitle}</h4>
            <div style={{ display: "grid", gap: "0.6rem" }}>
              {res.images.map((img) => (
                <ObservationCard
                  key={img.n}
                  image={img}
                  decision={decisions[`img:${img.n}`]?.decision}
                  copy={aiCopy}
                  onOpenPhoto={onOpenPhoto}
                />
              ))}
            </div>
          </section>

          <ConsistencyChip
            consistency={res.overall.consistencyWithReportedStage}
            copy={aiCopy}
            rationale={res.overall.rationale}
          />

          <DiscrepancyList
            discrepancies={res.potentialDiscrepancies}
            copy={aiCopy}
            onOpenPhoto={onOpenPhoto}
          />

          <UncertaintyPanel
            cannotBeDetermined={res.cannotBeDetermined}
            questionsForInspector={res.questionsForInspector}
            droppedStatements={res.droppedStatements}
            copy={aiCopy}
          />
        </>
      ) : null}
    </div>
  );
}
