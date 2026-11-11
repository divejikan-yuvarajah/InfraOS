"use client";

import { AlertTriangleIcon, EyeIcon } from "lucide-react";

import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";
import type { DiscrepancySeverity, VisionPotentialDiscrepancy } from "@/lib/inspections/ai/types";

import { fill } from "@/lib/inspections/view";
import { Chip } from "../inspection-ui";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

const DISCREPANCY_TONES: Record<DiscrepancySeverity, "neutral" | "pending" | "critical"> = {
  LOW: "neutral",
  MODERATE: "pending",
  HIGH: "critical",
};

export function DiscrepancyList({
  discrepancies,
  copy,
  onOpenPhoto,
}: {
  discrepancies: VisionPotentialDiscrepancy[];
  copy: InspectionAiMessages;
  onOpenPhoto?: (photoNumber: number) => void;
}) {
  return (
    <section className="ins-panel" aria-label={copy.results.discrepanciesTitle}>
      <h4 className="ins-h" style={{ marginBottom: "0.5rem" }}>{copy.results.discrepanciesTitle}</h4>
      {discrepancies.length === 0 ? (
        <p className="ins-muted" style={{ margin: 0, fontSize: "0.86rem" }}>{copy.results.noDiscrepancies}</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
          {discrepancies.map((item, idx) => (
            <li
              key={`${idx}-${item.statement.slice(0, 24)}`}
              className="ins-ai-obs"
              style={{ display: "grid", gap: "0.35rem" }}
            >
              <div className="ctr-row" style={{ gap: "0.5rem", flexWrap: "wrap", justifyContent: "space-between" }}>
                <Chip
                  tone={DISCREPANCY_TONES[item.severity] ?? "pending"}
                  icon={<AlertTriangleIcon aria-hidden="true" style={{ width: "0.85rem", height: "0.85rem" }} />}
                >
                  {copy.results.discrepancySeverity[item.severity] ?? item.severity}
                </Chip>
                {item.imageNs.length > 0 ? (
                  <div className="ctr-row" style={{ gap: "0.3rem", flexWrap: "wrap" }}>
                    {item.imageNs.map((n) =>
                      onOpenPhoto ? (
                        <button
                          key={n}
                          type="button"
                          className="ctr-btn is-ghost"
                          onClick={() => onOpenPhoto(n)}
                          aria-label={fill(copy.results.openPhoto, { n })}
                        >
                          <EyeIcon aria-hidden="true" />
                          <span>{fill(copy.results.photoLabel, { n })}</span>
                        </button>
                      ) : (
                        <span key={n} className="ins-badge">
                          {fill(copy.results.photoLabel, { n })}
                        </span>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
              <p style={{ margin: 0, fontSize: "0.88rem" }}>{item.statement}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
