"use client";

import { XIcon, ArrowRightIcon, PlusIcon, MinusIcon, TrendingUpIcon, TrendingDownIcon } from "lucide-react";
import type { RiskComparisonDto } from "@/lib/risk/types";
import { CATEGORY_LABELS } from "@/lib/risk/view";
import { LevelChip } from "./level-chip";

export function AssessmentCompareModal({
  comparison,
  onClose,
}: {
  comparison: RiskComparisonDto;
  onClose: () => void;
}) {
  const { fromAssessment, toAssessment, levelChange, indexDelta, categoryDeltas } = comparison;

  return (
    <div
      role="dialog"
      aria-labelledby="compare-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div>
            <h3 id="compare-modal-title" className="text-base font-bold text-text-primary">
              Risk Assessment Diff Comparison
            </h3>
            <p className="text-xs text-text-muted">
              Comparing baseline snapshot {fromAssessment.assessmentNo} against {toAssessment.assessmentNo}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:text-text-primary"
            aria-label="Close diff modal"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Level & Index Change Banner */}
        <div className="rounded-lg border border-border bg-surface-container-low/40 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <span className="text-text-muted block">Baseline ({fromAssessment.assessmentNo})</span>
              <LevelChip level={fromAssessment.overallLevel} size="md" />
            </div>
            <ArrowRightIcon className="size-4 text-text-muted mt-4" aria-hidden="true" />
            <div className="space-y-1">
              <span className="text-text-muted block">Target ({toAssessment.assessmentNo})</span>
              <LevelChip level={toAssessment.overallLevel} size="md" />
            </div>
          </div>

          <div className="text-right space-y-1">
            <span className="text-text-muted block">Overall Rule Points Delta</span>
            <span
              className={`font-mono text-base font-bold ${
                indexDelta > 0 ? "text-rose-600" : indexDelta < 0 ? "text-emerald-600" : "text-text-secondary"
              }`}
            >
              {indexDelta > 0 ? `+${indexDelta}` : indexDelta} pts
            </span>
          </div>
        </div>

        {/* Category Deltas */}
        {categoryDeltas && categoryDeltas.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-primary">
              Category Severity Shifts
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {categoryDeltas.map((d) => (
                <div
                  key={d.category}
                  className="rounded-lg border border-border bg-surface p-2.5 flex items-center justify-between"
                >
                  <span className="font-medium text-text-secondary">
                    {CATEGORY_LABELS[d.category]}
                  </span>
                  <div className="flex items-center gap-2">
                    <LevelChip level={d.fromLevel} size="sm" showGlyph={false} />
                    <span className="text-text-muted">→</span>
                    <LevelChip level={d.toLevel} size="sm" showGlyph={false} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Indicator Transition Blocks */}
        <div className="space-y-3 text-xs">
          {/* Added / Escalated */}
          {comparison.addedIndicators.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-rose-600">
                <PlusIcon className="size-3.5" aria-hidden="true" />
                <span>New Indicators Flagged ({comparison.addedIndicators.length})</span>
              </div>
              <ul className="space-y-1 pl-4 list-disc text-text-secondary">
                {comparison.addedIndicators.map((i) => (
                  <li key={i.fingerprint}>
                    <span className="font-mono font-bold text-infra-orange">{i.code}</span>: {i.titleKey} (+{i.points} pts, {i.severity})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {comparison.escalatedIndicators.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-orange-600">
                <TrendingUpIcon className="size-3.5" aria-hidden="true" />
                <span>Escalated Indicators ({comparison.escalatedIndicators.length})</span>
              </div>
              <ul className="space-y-1 pl-4 list-disc text-text-secondary">
                {comparison.escalatedIndicators.map((i) => (
                  <li key={i.fingerprint}>
                    <span className="font-mono font-bold text-infra-orange">{i.code}</span>: {i.titleKey} escalated to {i.severity}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Cleared / De-escalated */}
          {comparison.removedIndicators.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-600">
                <MinusIcon className="size-3.5" aria-hidden="true" />
                <span>Cleared Indicators ({comparison.removedIndicators.length})</span>
              </div>
              <ul className="space-y-1 pl-4 list-disc text-text-secondary">
                {comparison.removedIndicators.map((i) => (
                  <li key={i.fingerprint}>
                    <span className="font-mono font-bold text-text-primary">{i.code}</span>: {i.titleKey} resolved / cleared
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {comparison.deescalatedIndicators.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-teal-600">
                <TrendingDownIcon className="size-3.5" aria-hidden="true" />
                <span>De-escalated Indicators ({comparison.deescalatedIndicators.length})</span>
              </div>
              <ul className="space-y-1 pl-4 list-disc text-text-secondary">
                {comparison.deescalatedIndicators.map((i) => (
                  <li key={i.fingerprint}>
                    <span className="font-mono font-bold text-infra-orange">{i.code}</span>: {i.titleKey} reduced to {i.severity}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {comparison.addedIndicators.length === 0 &&
          comparison.removedIndicators.length === 0 &&
          comparison.escalatedIndicators.length === 0 &&
          comparison.deescalatedIndicators.length === 0 ? (
            <p className="text-text-muted italic text-center py-4">
              Identical indicators across both assessment snapshots. No new, cleared, or changed indicators.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end pt-3 border-t border-border/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-container-low"
          >
            Close Diff View
          </button>
        </div>
      </div>
    </div>
  );
}
