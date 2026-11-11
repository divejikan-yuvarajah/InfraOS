"use client";

import { AlertOctagonIcon, AlertTriangleIcon, InfoIcon } from "lucide-react";

import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";
import type { QualityCheckSeverity, QualityChecksOutputDto } from "@/lib/inspections/ai/types";

import { fill } from "@/lib/inspections/view";
import { Chip } from "../inspection-ui";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

const SEVERITY_TONES: Record<QualityCheckSeverity, "neutral" | "pending" | "critical"> = {
  INFO: "neutral",
  WARNING: "pending",
  CRITICAL: "critical",
};

const SEVERITY_ICONS: Record<QualityCheckSeverity, typeof InfoIcon> = {
  INFO: InfoIcon,
  WARNING: AlertTriangleIcon,
  CRITICAL: AlertOctagonIcon,
};

export function QualityChecksTable({
  qualityChecks,
  copy,
  evidenceIndexById,
}: {
  qualityChecks: QualityChecksOutputDto;
  copy: InspectionAiMessages;
  evidenceIndexById?: Map<string, number>;
}) {
  const { coverage, checks, metadataNote } = qualityChecks;
  const codeLabels = copy.qualityChecks.codes as Record<string, string>;

  return (
    <section className="ins-panel" aria-label={copy.qualityChecks.title}>
      <h4 className="ins-h" style={{ marginBottom: "0.4rem" }}>{copy.qualityChecks.title}</h4>
      <p className="ins-muted" style={{ margin: "0 0 0.4rem", fontSize: "0.86rem" }}>
        {fill(copy.qualityChecks.coverage, {
          photos: coverage.totalPhotos,
          covered: coverage.milestonesWithEvidence,
          total: coverage.totalMilestones,
        })}
      </p>
      {coverage.uncoveredMilestones.length > 0 ? (
        <p className="ins-muted" style={{ margin: "0 0 0.5rem", fontSize: "0.84rem" }}>
          {fill(copy.qualityChecks.uncovered, { list: coverage.uncoveredMilestones.join(", ") })}
        </p>
      ) : null}

      {checks.length === 0 ? (
        <p className="ins-muted" style={{ margin: "0 0 0.4rem", fontSize: "0.86rem" }}>
          {copy.qualityChecks.empty}
        </p>
      ) : (
        <div className="ctr-table-wrap" style={{ marginBottom: "0.5rem" }}>
          <table className="ctr-table" style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th scope="col">{copy.qualityChecks.colSeverity}</th>
                <th scope="col">{copy.qualityChecks.colCheck}</th>
                <th scope="col">{copy.qualityChecks.colDetails}</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((item, idx) => {
                const Icon = SEVERITY_ICONS[item.severity] ?? InfoIcon;
                const photoNum = item.evidenceId ? evidenceIndexById?.get(item.evidenceId) : undefined;
                return (
                  <tr key={`${item.code}-${item.evidenceId ?? idx}`}>
                    <td>
                      <Chip
                        tone={SEVERITY_TONES[item.severity] ?? "neutral"}
                        icon={<Icon aria-hidden="true" style={{ width: "0.85rem", height: "0.85rem" }} />}
                      >
                        {copy.qualityChecks.severity[item.severity] ?? item.severity}
                      </Chip>
                    </td>
                    <td>
                      {codeLabels[item.code] ?? item.code}
                      {photoNum !== undefined ? ` (${fill(copy.results.photoLabel, { n: photoNum })})` : ""}
                    </td>
                    <td>{item.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {metadataNote ? (
        <p className="ins-muted" style={{ margin: 0, fontSize: "0.8rem" }}>{metadataNote}</p>
      ) : null}
    </section>
  );
}
