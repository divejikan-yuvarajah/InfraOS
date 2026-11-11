"use client";

import { CheckIcon, MapPinIcon } from "lucide-react";

import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";
import type { QualityChecksOutputDto, SelectableEvidenceDto } from "@/lib/inspections/ai/types";
import type { Copy as InspectionCopy } from "@/lib/inspections/messages";

import { fill } from "@/lib/inspections/view";
import { AuthedImage } from "../inspection-ui";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

export function EvidencePicker({
  selectableEvidence,
  selectedIds,
  maxImages,
  qualityPreview,
  onToggle,
  aiCopy,
  inspectionCopy,
  disabled,
}: {
  selectableEvidence: SelectableEvidenceDto[];
  selectedIds: string[];
  maxImages: number;
  qualityPreview: QualityChecksOutputDto;
  onToggle: (evidenceId: string) => void;
  aiCopy: InspectionAiMessages;
  inspectionCopy: InspectionCopy;
  disabled?: boolean;
}) {
  const selectedSet = new Set(selectedIds);
  const atLimit = selectedIds.length >= maxImages;

  const warningsByEvidence = new Map<string, number>();
  for (const check of qualityPreview.checks) {
    if (check.evidenceId && check.severity !== "INFO") {
      warningsByEvidence.set(check.evidenceId, (warningsByEvidence.get(check.evidenceId) ?? 0) + 1);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "0.5rem" }}>
        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
          {fill(aiCopy.picker.title, { selected: selectedIds.length, max: maxImages })}
        </div>
        <p className="ins-muted" style={{ margin: "0.2rem 0 0", fontSize: "0.84rem" }}>
          {aiCopy.picker.hint}
        </p>
      </div>

      <div className="ins-ai-picker" role="group" aria-label={fill(aiCopy.picker.title, { selected: selectedIds.length, max: maxImages })}>
        {selectableEvidence.map((item, idx) => {
          const isSelected = selectedSet.has(item.evidenceId);
          const warnCount = warningsByEvidence.get(item.evidenceId) ?? 0;
          const isDisabled = Boolean(disabled) || (!isSelected && atLimit);

          return (
            <button
              key={item.evidenceId}
              type="button"
              className="ins-ai-pick-item"
              data-selected={isSelected ? "true" : "false"}
              aria-pressed={isSelected}
              disabled={isDisabled}
              onClick={() => onToggle(item.evidenceId)}
            >
              <div className="ins-ai-pick-thumb">
                <AuthedImage
                  evidenceId={item.evidenceId}
                  alt={fill(aiCopy.picker.selectPhoto, { n: idx + 1 })}
                  copy={inspectionCopy}
                />
              </div>
              <div className="ctr-row" style={{ justifyContent: "space-between", marginTop: "0.35rem", fontSize: "0.78rem" }}>
                <span style={{ fontWeight: 600 }}>{fill(aiCopy.results.photoLabel, { n: idx + 1 })}</span>
                {isSelected ? (
                  <CheckIcon aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem", color: "var(--accent, #1d4ed8)" }} />
                ) : null}
              </div>
              <div className="ctr-row" style={{ gap: "0.25rem", marginTop: "0.25rem", flexWrap: "wrap", fontSize: "0.72rem" }}>
                {item.sitePresence ? (
                  <span
                    className="ins-badge"
                    data-t={
                      item.sitePresence.status === "ON_SITE"
                        ? "site-on"
                        : item.sitePresence.status === "AWAY"
                          ? "site-away"
                          : "site"
                    }
                  >
                    <MapPinIcon aria-hidden="true" />
                    {item.sitePresence.status === "ON_SITE"
                      ? inspectionCopy.evidence.siteOn
                      : item.sitePresence.status === "NEAR_SITE"
                        ? inspectionCopy.evidence.siteNear
                        : inspectionCopy.evidence.siteAway}
                  </span>
                ) : null}
                <span className="ins-badge" data-t={warnCount > 0 ? "site-away" : "site-on"}>
                  {warnCount > 0 ? `${warnCount}` : aiCopy.picker.noIssues}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
