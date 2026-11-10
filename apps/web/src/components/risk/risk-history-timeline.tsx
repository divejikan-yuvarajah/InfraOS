"use client";

import { useState } from "react";
import { GitCommitIcon, ArrowRightIcon, RefreshCwIcon } from "lucide-react";
import type { RiskHistoryItemDto } from "@/lib/risk/types";
import { LevelChip } from "./level-chip";

export function RiskHistoryTimeline({
  items = [],
  onSelectAssessment,
  onCompare,
}: {
  items: RiskHistoryItemDto[];
  onSelectAssessment?: (assessmentId: string) => void;
  onCompare?: (fromId: string, toId: string) => void;
}) {
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  function toggleCompare(id: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 2) return [prev[1]!, id];
      return [...prev, id];
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Assessment Snapshots Timeline
          </h3>
          <p className="text-xs text-text-muted">
            Append-only historical audit trace of calculated project risk evaluations.
          </p>
        </div>

        {selectedForCompare.length === 2 && onCompare ? (
          <button
            type="button"
            onClick={() => onCompare(selectedForCompare[0]!, selectedForCompare[1]!)}
            className="inline-flex items-center gap-1.5 rounded-md bg-infra-orange px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-orange-600"
          >
            <span>Compare Selected Snapshots</span>
            <ArrowRightIcon className="size-3.5" />
          </button>
        ) : (
          <span className="text-xs text-text-muted">
            Select any 2 snapshots to view diff
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-text-muted rounded-lg border border-dashed border-border">
          No historical assessment snapshots recorded yet.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
          {items.map((item) => {
            const isComparing = selectedForCompare.includes(item.id);

            return (
              <div
                key={item.id}
                className="relative flex items-start gap-3 rounded-lg border border-border bg-surface p-3.5 text-xs shadow-2xs hover:bg-surface-container-low/30 transition-colors"
              >
                {/* Timeline node */}
                <div
                  className="absolute -left-[27px] top-4 size-3 rounded-full border-2 border-surface bg-infra-orange shadow-xs"
                  aria-hidden="true"
                />

                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-text-primary">
                        {item.assessmentNo}
                      </span>
                      <span className="inline-flex items-center rounded bg-surface-container-low px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                        {item.trigger}
                      </span>
                      <LevelChip level={item.overallLevel} size="sm" />
                    </div>

                    <span className="text-[11px] text-text-muted">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-text-secondary pt-1 border-t border-border/30">
                    <div className="flex items-center gap-2">
                      {item.overallIndex !== undefined ? (
                        <span>Rule Index: {item.overallIndex} pts</span>
                      ) : null}
                      <span>·</span>
                      <span>Changes Detected: {item.changesCount}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1 cursor-pointer select-none text-[11px] font-medium text-text-secondary">
                        <input
                          type="checkbox"
                          checked={isComparing}
                          onChange={() => toggleCompare(item.id)}
                          className="rounded border-border text-infra-orange focus:ring-ring"
                        />
                        <span>Compare</span>
                      </label>

                      {onSelectAssessment ? (
                        <button
                          type="button"
                          onClick={() => onSelectAssessment(item.id)}
                          className="text-infra-orange font-semibold hover:underline"
                        >
                          View Snapshot →
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
