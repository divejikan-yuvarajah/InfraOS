"use client";

import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";

import type { AuthLocale } from "@/lib/auth/types";
import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";
import type { InspectionAiAnalysisView } from "@/lib/inspections/ai/types";
import type { Copy as InspectionCopy } from "@/lib/inspections/messages";
import type { EvidenceItem } from "@/lib/inspections/types";
import { fill, fmtDateTime } from "@/lib/inspections/view";

import { AuthedImage, Chip } from "../inspection-ui";
import { AnalysisProgress } from "./analysis-progress";
import { AnalysisPhotoDialog, AnalysisResultSections } from "./observation-card";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

export function AiHistoryList({
  analyses,
  evidence,
  aiCopy,
  inspectionCopy,
  locale,
}: {
  analyses: InspectionAiAnalysisView[];
  evidence: EvidenceItem[];
  aiCopy: InspectionAiMessages;
  inspectionCopy: InspectionCopy;
  locale: AuthLocale;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(analyses[0]?.id ?? null);
  const [lightboxState, setLightboxState] = useState<{ analysis: InspectionAiAnalysisView; photoNumber: number } | null>(null);

  const activeEvidenceIds = new Set(evidence.filter((e) => e.status === "ACTIVE").map((e) => e.id));

  return (
    <section className="ins-panel" aria-label={aiCopy.history.title}>
      <h3 className="ins-h" style={{ marginBottom: "0.6rem" }}>{aiCopy.history.title}</h3>

      {analyses.length === 0 ? (
        <p className="ins-muted" style={{ margin: 0 }}>{aiCopy.history.empty}</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div className="ctr-table-wrap">
            <table className="ctr-table" style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th scope="col">{aiCopy.history.analysisCol}</th>
                  <th scope="col">{aiCopy.history.requesterCol}</th>
                  <th scope="col">{aiCopy.history.dateCol}</th>
                  <th scope="col">{aiCopy.history.photosCol}</th>
                  <th scope="col">{aiCopy.history.statusCol}</th>
                  <th scope="col">{aiCopy.history.reviewCol}</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {analyses.map((a) => {
                  const isOpen = expandedId === a.id;
                  return (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.analysisNo}</strong>
                        {a.supersededBy ? (
                          <span style={{ marginInlineStart: "0.4rem" }}>
                            <Chip tone="pending">{aiCopy.status.SUPERSEDED}</Chip>
                          </span>
                        ) : null}
                      </td>
                      <td>{a.requestedByRole}</td>
                      <td>{fmtDateTime(a.createdAt, locale)}</td>
                      <td>{a.evidence.length}</td>
                      <td>{aiCopy.status[a.status]}</td>
                      <td>
                        <Chip tone={a.inspectorReview.status === "REVIEWED" ? "success" : "pending"}>
                          {a.inspectorReview.status === "REVIEWED"
                            ? aiCopy.status.REVIEWED
                            : aiCopy.status.PENDING_REVIEW}
                        </Chip>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ctr-btn is-ghost"
                          aria-expanded={isOpen}
                          onClick={() => setExpandedId(isOpen ? null : a.id)}
                        >
                          {isOpen ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
                          <span>{isOpen ? aiCopy.history.hideResult : aiCopy.history.viewResult}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {analyses.map((a) => {
            if (expandedId !== a.id) return null;
            return (
              <article key={`${a.id}-detail`} className="ins-ai-advisory">
                <div className="ins-ai-advisory-banner">
                  <strong>{a.analysisNo}</strong>
                  <span>{aiCopy.advisoryBanner}</span>
                </div>

                <div className="ctr-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  {a.evidence.map((ev, idx) => {
                    const stillPresent = activeEvidenceIds.has(ev.evidenceId);
                    const photoLabel = fill(aiCopy.results.photoLabel, { n: idx + 1 });
                    return stillPresent ? (
                      <button
                        key={ev.evidenceId}
                        type="button"
                        className="ins-ai-pick-item"
                        style={{ width: "6.5rem" }}
                        onClick={() => setLightboxState({ analysis: a, photoNumber: idx + 1 })}
                        aria-label={fill(aiCopy.results.openPhoto, { n: idx + 1 })}
                      >
                        <div className="ins-ai-pick-thumb">
                          <AuthedImage evidenceId={ev.evidenceId} alt={photoLabel} copy={inspectionCopy} />
                        </div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>{photoLabel}</span>
                      </button>
                    ) : (
                      <div key={ev.evidenceId} className="ins-panel" style={{ fontSize: "0.78rem" }}>
                        <strong>{photoLabel}</strong>
                        <div className="ins-muted">{inspectionCopy.evidence.removed}</div>
                      </div>
                    );
                  })}
                </div>

                {a.status === "QUEUED" || a.status === "RUNNING" || a.status === "FAILED" ? (
                  <AnalysisProgress analysis={a} copy={aiCopy} locale={locale} />
                ) : (
                  <AnalysisResultSections
                    analysis={a}
                    aiCopy={aiCopy}
                    onOpenPhoto={(n) => setLightboxState({ analysis: a, photoNumber: n })}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}

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
