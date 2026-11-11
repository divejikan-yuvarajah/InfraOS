import type { InspectionAiMessages } from "./messages-en";
import type { InspectionAiAnalysisView, InspectorDecision, VisionAnalysisResult } from "./types";

export type ReviewableItem = {
  key: string;
  kind: "overall" | "image" | "discrepancy";
  label: string;
  previewText: string;
};

/** Enumerates every item requiring explicit inspector review (overall + img:n + disc:i). */
export function reviewableItemsOf(
  result: VisionAnalysisResult | undefined,
  copy: InspectionAiMessages,
): ReviewableItem[] {
  if (!result) return [];
  const items: ReviewableItem[] = [
    {
      key: "overall",
      kind: "overall",
      label: copy.results.overallAssessmentTitle,
      previewText: `AI Advisory Assessment (Confirmed): ${result.overall.rationale}`,
    },
  ];

  for (const img of result.images) {
    items.push({
      key: `img:${img.n}`,
      kind: "image",
      label: copy.results.photoLabel.replace("{n}", String(img.n)),
      previewText: `Photo ${img.n} Observation (Confirmed): ${img.activityDescription}`,
    });
  }

  result.potentialDiscrepancies.forEach((disc, idx) => {
    items.push({
      key: `disc:${idx}`,
      kind: "discrepancy",
      label: copy.results.discrepancyLabel.replace("{n}", String(idx + 1)),
      previewText: `Site Verification Note: ${disc.statement}`,
    });
  });

  return items;
}

export function reviewProgressOf(
  analysis: InspectionAiAnalysisView | undefined,
  localDecisions: Record<string, { decision: InspectorDecision; comment?: string }>,
  copy: InspectionAiMessages,
): { reviewedCount: number; totalCount: number; confirmedKeys: string[] } {
  const items = reviewableItemsOf(analysis?.result, copy);
  const confirmedKeys: string[] = [];
  let reviewedCount = 0;

  for (const item of items) {
    const dec = localDecisions[item.key]?.decision ?? analysis?.inspectorReview?.decisions?.[item.key]?.decision;
    if (dec) {
      reviewedCount++;
      if (dec === "CONFIRMED") confirmedKeys.push(item.key);
    }
  }

  return { reviewedCount, totalCount: items.length, confirmedKeys };
}

export function isVisionTerminalStatus(status: InspectionAiAnalysisView["status"] | undefined): boolean {
  return status === "READY" || status === "FAILED";
}

export function visionPollIntervalMs(
  status: InspectionAiAnalysisView["status"] | undefined,
  isTabVisible = true,
): number | false {
  if (!isTabVisible) return false;
  if (!status || isVisionTerminalStatus(status)) return false;
  return 1_000;
}

