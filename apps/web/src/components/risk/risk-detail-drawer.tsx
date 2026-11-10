"use client";

import Link from "next/link";
import {
  XIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  HelpCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { useState } from "react";
import type {
  RiskAssessmentDto,
  RiskFactorCategory,
  RiskIndicatorDto,
  RiskResolutionDto,
} from "@/lib/risk/types";
import { getIndicatorExplanation, getIndicatorTitle, RECOMMENDATION_COPY } from "@/lib/risk/indicator-copy";
import { CATEGORY_LABELS } from "@/lib/risk/view";
import { LevelChip } from "./level-chip";
import { SufficiencyChip } from "./sufficiency-chip";
import { BasisChip } from "./basis-chip";
import { FreshnessChip } from "./freshness-chip";
import { ResolutionChip } from "./resolution-chip";
import { HowCalculatedPopover } from "./how-calculated-popover";
import { NarrativePanel } from "./narrative-panel";
import { ResolutionDialog } from "./resolution-dialog";

export function RiskDetailDrawer({
  projectId,
  assessment,
  resolutions = [],
  onClose,
  onAssessNow,
  isAssessing = false,
  canAssess = false,
  canResolve = false,
  onResolutionUpdated,
}: {
  projectId: string;
  assessment: RiskAssessmentDto;
  resolutions?: RiskResolutionDto[];
  onClose: () => void;
  onAssessNow?: () => void;
  isAssessing?: boolean;
  canAssess?: boolean;
  canResolve?: boolean;
  onResolutionUpdated?: (resolution: RiskResolutionDto) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<RiskFactorCategory | "ALL">("ALL");
  const [selectedIndicatorForResolution, setSelectedIndicatorForResolution] =
    useState<RiskIndicatorDto | null>(null);

  const resolutionMap = new Map<string, RiskResolutionDto>();
  for (const r of resolutions) {
    resolutionMap.set(r.fingerprint, r);
  }

  const indicators = assessment.indicators ?? [];
  const assessableCount = (assessment.categories ?? []).filter(
    (c) => c.level !== "NOT_ASSESSABLE" && c.sufficiency !== "INSUFFICIENT",
  ).length;

  const filteredIndicators =
    activeCategory === "ALL"
      ? indicators
      : indicators.filter((i) => i.category === activeCategory);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label="Project Risk Analysis Drawer"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-surface border-l border-border shadow-2xl overflow-y-auto"
      >
        {/* Drawer Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-6 py-4 backdrop-blur-xs">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-infra-orange">
                {assessment.assessmentNo}
              </span>
              <span className="text-xs text-text-muted">·</span>
              <span className="text-xs text-text-muted">
                {new Date(assessment.createdAt).toLocaleString()}
              </span>
            </div>
            <h2 className="text-base font-bold text-text-primary truncate mt-0.5">
              Project Risk Intelligence
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {canAssess && onAssessNow ? (
              <button
                type="button"
                onClick={onAssessNow}
                disabled={isAssessing}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-container-low disabled:opacity-50"
              >
                <RefreshCwIcon className={`size-3.5 ${isAssessing ? "animate-spin text-infra-orange" : ""}`} />
                <span>{isAssessing ? "Evaluating…" : "Assess Now"}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-text-muted hover:bg-surface-container-low hover:text-text-primary"
              aria-label="Close drawer"
            >
              <XIcon className="size-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="p-6 space-y-6">
          {/* Summary Banner */}
          <div className="rounded-xl border border-border bg-surface-container-low/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LevelChip level={assessment.overallLevel} size="lg" />
                {assessment.overallIndex !== undefined ? (
                  <div>
                    <span className="text-xs text-text-muted block">Rule-points Index:</span>
                    <span
                      className="font-mono text-lg font-bold text-text-primary cursor-help"
                      title="Transparent rule-points sum (not a predictive probability)"
                    >
                      {assessment.overallIndex} / 100
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="text-right">
                <span className="text-xs text-text-secondary block">
                  Based on {assessableCount} of 5 assessable categories
                </span>
                <span className="text-[11px] text-text-muted italic">
                  Engine: {assessment.engineVersion}
                </span>
              </div>
            </div>

            {/* Category Sufficiency Pips */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-border/40 text-xs">
              {(assessment.categories ?? []).map((cat) => (
                <div key={cat.category} className="space-y-1">
                  <span className="font-medium text-text-secondary text-[11px] block truncate">
                    {CATEGORY_LABELS[cat.category]}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <LevelChip level={cat.level} size="sm" showGlyph={false} />
                    <span className="font-mono text-[10px] text-text-muted">{cat.index}pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Narrative Section (Optional) */}
          <NarrativePanel
            projectId={projectId}
            assessment={assessment}
            canRequest={canAssess}
          />

          {/* Indicators Category Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                Triggered Risk Indicators ({indicators.length})
              </h3>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => setActiveCategory("ALL")}
                  className={`rounded-md px-2.5 py-1 font-medium ${
                    activeCategory === "ALL"
                      ? "bg-infra-orange text-white"
                      : "text-text-secondary hover:bg-surface-container-low"
                  }`}
                >
                  All ({indicators.length})
                </button>
                {(assessment.categories ?? []).map((cat) => (
                  <button
                    key={cat.category}
                    type="button"
                    onClick={() => setActiveCategory(cat.category)}
                    className={`rounded-md px-2.5 py-1 font-medium whitespace-nowrap ${
                      activeCategory === cat.category
                        ? "bg-infra-orange text-white"
                        : "text-text-secondary hover:bg-surface-container-low"
                    }`}
                  >
                    {CATEGORY_LABELS[cat.category]}
                  </button>
                ))}
              </div>
            </div>

            {/* Indicators List */}
            {filteredIndicators.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-text-muted text-xs">
                No active indicators flagged in this category.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIndicators.map((ind) => {
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

                      {/* Plain-Language Deterministic Explanation */}
                      <p className="text-text-secondary leading-relaxed bg-surface-container-low/50 p-2.5 rounded-md">
                        {explanation}
                      </p>

                      {/* Evidence List */}
                      {ind.evidence && ind.evidence.length > 0 ? (
                        <div className="space-y-1">
                          <span className="font-medium text-text-secondary text-[11px]">
                            Grounding Evidence:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {ind.evidence.map((ev, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded bg-surface-container-low px-2 py-0.5 text-[11px] text-text-secondary border border-border/50"
                              >
                                <span className="font-mono font-semibold">{ev.ref.label ?? ev.ref.id}</span>
                                {ev.value !== undefined ? (
                                  <span>
                                    ({ev.value} {ev.unit ?? ""})
                                  </span>
                                ) : null}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Indicator Footer Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/30 text-xs">
                        <HowCalculatedPopover indicator={ind} />

                        {canResolve ? (
                          <button
                            type="button"
                            onClick={() => setSelectedIndicatorForResolution(ind)}
                            className="inline-flex items-center gap-1 text-infra-orange font-semibold hover:underline"
                          >
                            <span>
                              {resolution ? "Update Triage Status" : "Acknowledge / Resolve"}
                            </span>
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">
                  Advisory Recommendations
                </h3>
                <span className="text-[11px] text-text-muted italic">
                  Advisory only — decisions remain with authorised officers
                </span>
              </div>

              <div className="space-y-2">
                {assessment.recommendations!.map((rec) => {
                  const recInfo = RECOMMENDATION_COPY[rec.code] ?? {
                    title: rec.code,
                    body: "Review project work plan and monitor milestones.",
                    ctaText: "Open Project Workspace",
                  };

                  return (
                    <div
                      key={rec.code}
                      className="rounded-lg border border-border bg-surface p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-text-primary">
                          {recInfo.title}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            rec.priority === "HIGH"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {rec.priority} PRIORITY
                        </span>
                      </div>
                      <p className="text-text-secondary leading-relaxed">
                        {recInfo.body}
                      </p>
                      <div className="pt-1">
                        <Link
                          href={`/projects/${projectId}/overview`}
                          className="inline-flex items-center gap-1 text-infra-orange font-semibold hover:underline"
                        >
                          <span>{recInfo.ctaText}</span>
                          <ExternalLinkIcon className="size-3" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Missing Information Panel */}
          {(assessment.missingData ?? []).length > 0 ? (
            <div className="rounded-lg border border-border bg-surface-container-low/30 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-text-secondary font-semibold">
                <HelpCircleIcon className="size-4" aria-hidden="true" />
                <span>Data Completeness &amp; Readiness Gaps</span>
              </div>
              <p className="text-text-muted">
                The following inputs were absent during this evaluation. Adding records improves assessment fidelity:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-text-secondary font-mono text-[11px]">
                {assessment.missingData!.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Triage Dialog */}
      {selectedIndicatorForResolution ? (
        <ResolutionDialog
          projectId={projectId}
          indicator={selectedIndicatorForResolution}
          existingResolution={resolutionMap.get(selectedIndicatorForResolution.fingerprint)}
          assessmentId={assessment.id ?? (assessment as any)._id}
          onClose={() => setSelectedIndicatorForResolution(null)}
          onSaved={(updated) => {
            if (onResolutionUpdated) onResolutionUpdated(updated);
          }}
        />
      ) : null}
    </>
  );
}
