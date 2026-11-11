"use client";

import type { AiLimitsMeDto } from "@/lib/ai-admin/types";
import type { InspectionAiMessages } from "@/lib/inspections/ai/messages";

import { fill } from "@/lib/inspections/view";
import "@/styles/contractors.css";
import "@/styles/inspections.css";

export function CostEstimate({
  selectedCount,
  maxImages,
  estimatedCostUnits,
  limits,
  copy,
}: {
  selectedCount: number;
  maxImages: number;
  estimatedCostUnits: number;
  limits: AiLimitsMeDto | null;
  copy: InspectionAiMessages;
}) {
  const visionLimits = limits?.features?.vision;
  const remaining10m = visionLimits ? visionLimits.remaining10Min : "—";
  const dailyUsed = limits?.dailyVisionImagesUsed ?? "—";
  const dailyLimit = limits?.dailyVisionImagesLimit ?? "—";

  return (
    <div className="ins-panel" aria-label={copy.costEstimate.title} style={{ fontSize: "0.84rem" }}>
      <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>{copy.costEstimate.title}</div>
      <div className="ctr-row" style={{ gap: "1rem", flexWrap: "wrap" }}>
        <span>{fill(copy.costEstimate.selectedCount, { n: selectedCount, max: maxImages })}</span>
        <span>{fill(copy.costEstimate.costUnits, { units: estimatedCostUnits })}</span>
        <span>{fill(copy.costEstimate.remaining10m, { n: remaining10m })}</span>
        <span>{fill(copy.costEstimate.dailyImages, { used: dailyUsed, limit: dailyLimit })}</span>
      </div>
    </div>
  );
}
