"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon, HistoryIcon, GitCompareIcon } from "lucide-react";
import {
  assessProjectOnDemand,
  compareRiskAssessments,
  fetchProjectResolutions,
  fetchProjectRisk,
  fetchProjectRiskHistory,
} from "@/lib/risk/api";
import { canHintRisk, canResolveRisk } from "@/lib/risk/session";
import type { RiskComparisonDto, RiskResolutionDto } from "@/lib/risk/types";
import { LevelChip } from "./level-chip";
import { RiskHistoryTimeline } from "./risk-history-timeline";
import { AssessmentCompareModal } from "./assessment-compare";
import { NarrativePanel } from "./narrative-panel";
import { ResolutionDialog } from "./resolution-dialog";
import { HowCalculatedPopover } from "./how-calculated-popover";
import { BasisChip } from "./basis-chip";
import { ResolutionChip } from "./resolution-chip";
import { getIndicatorExplanation, getIndicatorTitle, RECOMMENDATION_COPY } from "@/lib/risk/indicator-copy";
import { CATEGORY_LABELS } from "@/lib/risk/view";

export function ProjectRiskTabClient({
  projectId,
  roleKey = "",
}: {
  projectId: string;
  roleKey?: string;
}) {
  const queryClient = useQueryClient();
  const canAssess = canHintRisk(roleKey);
  const canResolve = canResolveRisk(roleKey);

  const [activeTab, setActiveTab] = useState<"ANALYSIS" | "HISTORY">("ANALYSIS");
  const [isAssessing, setIsAssessing] = useState(false);
  const [selectedIndicatorForResolution, setSelectedIndicatorForResolution] = useState<any>(null);
  const [activeComparison, setActiveComparison] = useState<RiskComparisonDto | null>(null);

  // 1. Latest Risk Assessment
  const { data: latestData, refetch: refetchLatest } = useQuery({
    queryKey: ["risk", "project", projectId],
    queryFn: () => fetchProjectRisk(projectId),
  });

  // 2. Risk History Snapshots
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["risk", "history", projectId],
    queryFn: () => fetchProjectRiskHistory(projectId),
  });

  // 3. Resolutions
  const { data: resolutionsData, refetch: refetchResolutions } = useQuery({
    queryKey: ["risk", "resolutions", projectId],
    queryFn: () => fetchProjectResolutions(projectId),
  });

  const assessment = latestData?.assessment;
  const resolutions = resolutionsData?.items ?? [];
  const resolutionMap = new Map<string, RiskResolutionDto>();
  for (const r of resolutions) resolutionMap.set(r.fingerprint, r);

  async function handleAssessNow() {
    setIsAssessing(true);
    try {
      await assessProjectOnDemand(projectId, true);
      queryClient.invalidateQueries({ queryKey: ["risk"] });
      refetchLatest();
      refetchHistory();
    } catch (err: any) {
      console.error("Assessment failed:", err);
    } finally {
      setIsAssessing(false);
    }
  }

  async function handleCompare(fromId: string, toId: string) {
    try {
      const diff = await compareRiskAssessments(projectId, fromId, toId);
      setActiveComparison(diff);
    } catch (err: any) {
      console.error("Comparison failed:", err);
    }
  }

  if (!assessment) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center space-y-4">
        <p className="text-sm font-medium text-text-secondary">
          No automated risk assessment has been recorded for this project yet.
        </p>
        {canAssess ? (
          <button
            type="button"
            onClick={handleAssessNow}
            disabled={isAssessing}
            className="inline-flex items-center gap-1.5 rounded-md bg-infra-orange px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-orange-600 disabled:opacity-50"
          >
            <RefreshCwIcon className={`size-3.5 ${isAssessing ? "animate-spin" : ""}`} />
            <span>{isAssessing ? "Evaluating Project…" : "Run Initial Assessment"}</span>
          </button>
        ) : null}
      </div>
    );
  }

  const indicators = assessment.indicators ?? [];

  return (
    <div className="space-y-6">
      {/* Top Banner / Assessment Card */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <LevelChip level={assessment.overallLevel} size="lg" />
            <div>
              <span className="text-xs text-text-muted block">Assessment No:</span>
              <span className="font-mono text-sm font-bold text-text-primary">
                {assessment.assessmentNo}
              </span>
            </div>
            {assessment.overallIndex !== undefined ? (
              <div className="border-l border-border/60 pl-3">
                <span className="text-xs text-text-muted block">Rule Index:</span>
                <span className="font-mono text-sm font-bold text-text-primary">
                  {assessment.overallIndex} / 100 pts
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border p-1 bg-surface-container-low/40 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("ANALYSIS")}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  activeTab === "ANALYSIS"
                    ? "bg-surface shadow-xs text-text-primary font-semibold"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Risk Analysis
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("HISTORY")}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  activeTab === "HISTORY"
                    ? "bg-surface shadow-xs text-text-primary font-semibold"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                History Timeline ({historyData?.items?.length ?? 0})
              </button>
            </div>

            {canAssess ? (
              <button
                type="button"
                onClick={handleAssessNow}
                disabled={isAssessing}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-container-low disabled:opacity-50"
              >
                <RefreshCwIcon className={`size-3.5 ${isAssessing ? "animate-spin text-infra-orange" : ""}`} />
                <span>{isAssessing ? "Evaluating…" : "Assess Now"}</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Category Breakdown row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 text-xs">
          {(assessment.categories ?? []).map((cat) => (
            <div
              key={cat.category}
              className="p-3 rounded-lg border border-border/60 bg-surface-container-low/30 space-y-1.5"
            >
              <span className="font-medium text-text-secondary block truncate">
                {CATEGORY_LABELS[cat.category]}
              </span>
              <div className="flex items-center justify-between">
                <LevelChip level={cat.level} size="sm" showGlyph={false} />
                <span className="font-mono text-[11px] text-text-muted">{cat.index} pts</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeTab === "ANALYSIS" ? (
        <div className="space-y-6">
          {/* AI Narrative Section */}
          <NarrativePanel
            projectId={projectId}
            assessment={assessment}
            canRequest={canAssess}
          />

          {/* Triggered Indicators Accordion */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">
              Triggered Indicators ({indicators.length})
            </h3>

            {indicators.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-muted">
                No active risk indicators triggered for this project.
              </div>
            ) : (
              <div className="space-y-3">
                {indicators.map((ind) => {
                  const title = getIndicatorTitle(ind);
                  const explanation = getIndicatorExplanation(ind);
                  const resolution = resolutionMap.get(ind.fingerprint);

                  return (
                    <div
                      key={ind.fingerprint}
                      className="rounded-lg border border-border bg-surface p-4 shadow-2xs space-y-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-infra-orange">
                              {ind.code}
                            </span>
                            <LevelChip level={ind.severity as any} size="sm" />
                            <BasisChip basis={ind.basis} />
                            {resolution ? (
                              <ResolutionChip
                                status={resolution.status}
                                isReopened={Boolean((resolution as any).isReopened)}
                              />
                            ) : null}
                          </div>
                          <h4 className="font-semibold text-text-primary mt-1 text-sm">
                            {title}
                          </h4>
                        </div>
                        <span className="font-mono font-bold text-text-secondary text-sm">
                          +{ind.points} pts
                        </span>
                      </div>

                      <p className="text-text-secondary leading-relaxed bg-surface-container-low/50 p-2.5 rounded-md">
                        {explanation}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <HowCalculatedPopover indicator={ind} />

                        {canResolve ? (
                          <button
                            type="button"
                            onClick={() => setSelectedIndicatorForResolution(ind)}
                            className="text-infra-orange font-semibold hover:underline"
                          >
                            {resolution ? "Update Triage Status" : "Acknowledge / Resolve"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Advisory Recommendations */}
          {(assessment.recommendations ?? []).length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">
                Advisory Recommendations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {assessment.recommendations!.map((rec) => {
                  const copy = RECOMMENDATION_COPY[rec.code] ?? {
                    title: rec.code,
                    body: "Review work schedule and project milestones.",
                    ctaText: "Open Project",
                  };
                  return (
                    <div
                      key={rec.code}
                      className="rounded-lg border border-border bg-surface p-4 text-xs space-y-2"
                    >
                      <span className="font-semibold text-text-primary block">
                        {copy.title}
                      </span>
                      <p className="text-text-secondary leading-relaxed">
                        {copy.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Triage / Resolutions Log */}
          {resolutions.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">
                  Team Triage &amp; Resolution Actions
                </h3>
                <span className="text-[11px] text-text-muted italic">
                  Team actions are logged for governance audit trails and do not alter calculated rule points.
                </span>
              </div>

              <div className="rounded-lg border border-border bg-surface divide-y divide-border/40 text-xs">
                {resolutions.map((r) => (
                  <div key={r.fingerprint} className="p-3 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-text-primary">
                          {r.fingerprint}
                        </span>
                        <ResolutionChip status={r.status} isReopened={r.reopened} />
                      </div>
                      <p className="text-text-secondary">{r.note}</p>
                      <p className="text-[10px] text-text-muted">
                        Updated {new Date(r.decidedAt).toLocaleString()} · Version {r.version}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <RiskHistoryTimeline
          items={historyData?.items ?? []}
          onCompare={handleCompare}
        />
      )}

      {/* Resolution Dialog Modal */}
      {selectedIndicatorForResolution ? (
        <ResolutionDialog
          projectId={projectId}
          indicator={selectedIndicatorForResolution}
          existingResolution={resolutionMap.get(selectedIndicatorForResolution.fingerprint)}
          assessmentId={assessment.id ?? (assessment as any)._id}
          onClose={() => setSelectedIndicatorForResolution(null)}
          onSaved={() => {
            refetchResolutions();
            refetchLatest();
          }}
        />
      ) : null}

      {/* Compare Diff Modal */}
      {activeComparison ? (
        <AssessmentCompareModal
          comparison={activeComparison}
          onClose={() => setActiveComparison(null)}
        />
      ) : null}
    </div>
  );
}
