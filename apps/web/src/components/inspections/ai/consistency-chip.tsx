"use client";

import { AlertTriangleIcon, CheckCircle2Icon, HelpCircleIcon, XCircleIcon } from "lucide-react";

import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";
import type { VisionConsistency } from "@/lib/inspections/ai/types";

import { Chip } from "../inspection-ui";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

const TONES: Record<VisionConsistency, "success" | "pending" | "critical" | "neutral"> = {
  CONSISTENT: "success",
  PARTIALLY_CONSISTENT: "pending",
  INCONSISTENT: "critical",
  INDETERMINATE: "neutral",
};

const ICONS: Record<VisionConsistency, typeof CheckCircle2Icon> = {
  CONSISTENT: CheckCircle2Icon,
  PARTIALLY_CONSISTENT: AlertTriangleIcon,
  INCONSISTENT: XCircleIcon,
  INDETERMINATE: HelpCircleIcon,
};

export function ConsistencyChip({
  consistency,
  copy,
  rationale,
}: {
  consistency: VisionConsistency;
  copy: InspectionAiMessages;
  rationale?: string;
}) {
  const Icon = ICONS[consistency] ?? HelpCircleIcon;
  const label = copy.results.consistency[consistency] ?? consistency;
  const tone = TONES[consistency] ?? "neutral";

  return (
    <section className="ins-panel" aria-label={copy.results.overallSectionTitle}>
      <h4 className="ins-h" style={{ marginBottom: "0.5rem" }}>{copy.results.overallSectionTitle}</h4>
      <div className="ctr-row" style={{ gap: "0.6rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.5rem" }}>
        <Chip tone={tone} icon={<Icon aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem" }} />}>
          {label}
        </Chip>
        <span className="ins-muted" style={{ fontSize: "0.82rem" }}>
          {copy.results.standingRuleLine}
        </span>
      </div>
      {rationale ? (
        <p style={{ margin: 0, fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{rationale}</p>
      ) : null}
    </section>
  );
}
