"use client";

import { InfoIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { RiskIndicatorDto } from "@/lib/risk/types";
import { BasisChip } from "./basis-chip";

export function HowCalculatedPopover({
  indicator,
}: {
  indicator: RiskIndicatorDto;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-container-low hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <InfoIcon className="size-3.5" aria-hidden="true" />
        <span>How Calculated</span>
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label={`Calculation details for indicator ${indicator.code}`}
            className="absolute left-0 z-50 mt-1 w-80 sm:w-96 rounded-lg border border-border bg-surface p-4 shadow-xl text-left space-y-3"
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-infra-orange">
                  {indicator.code}
                </span>
                <h4 className="text-sm font-semibold text-text-primary">
                  Mathematical Grounding
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-text-muted hover:text-text-primary focus:outline-none"
                aria-label="Close calculation dialog"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Severity & Points:</span>
                <span className="font-mono font-bold text-text-primary">
                  {indicator.severity} ({indicator.points} rule pts)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Grounding Basis:</span>
                <BasisChip basis={indicator.basis} />
              </div>

              {indicator.calc?.formulaKey ? (
                <div>
                  <span className="font-medium text-text-secondary">Formula Key:</span>
                  <p className="font-mono text-[11px] bg-surface-container-low p-1.5 rounded mt-0.5 text-text-primary">
                    {indicator.calc.formulaKey}
                  </p>
                </div>
              ) : null}

              {indicator.calc?.steps && indicator.calc.steps.length > 0 ? (
                <div>
                  <span className="font-medium text-text-secondary">Evaluation Steps:</span>
                  <ol className="list-decimal list-inside space-y-1 mt-1 font-mono text-[11px] text-text-secondary bg-surface-container-low/60 p-2 rounded">
                    {indicator.calc.steps.map((step, idx) => (
                      <li key={idx} className="break-words">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {indicator.inputs && Object.keys(indicator.inputs).length > 0 ? (
                <div>
                  <span className="font-medium text-text-secondary">Evidence Inputs:</span>
                  <pre className="mt-1 max-h-28 overflow-y-auto rounded bg-surface-container-low p-2 font-mono text-[10px] text-text-secondary">
                    {JSON.stringify(indicator.inputs, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>

            <p className="text-[10px] text-text-muted border-t border-border/40 pt-2 italic">
              Evaluated deterministically by Rule Engine baseline (no predictive probability).
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
