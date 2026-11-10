"use client";

import { useState } from "react";
import { SparklesIcon, ChevronDownIcon, ChevronUpIcon, RefreshCwIcon, AlertCircleIcon } from "lucide-react";
import type { RiskAssessmentDto } from "@/lib/risk/types";
import { explainAssessmentNarrative } from "@/lib/risk/api";

export function NarrativePanel({
  projectId,
  assessment,
  canRequest = false,
  className = "",
}: {
  projectId: string;
  assessment: RiskAssessmentDto;
  canRequest?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [narrative, setNarrative] = useState(assessment.narrative);
  const [language, setLanguage] = useState<"en" | "si" | "ta">("en");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleGenerate(regenerate = false) {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const aid = assessment.id ?? (assessment as any)._id;
      const res = await explainAssessmentNarrative(projectId, aid, {
        language,
        regenerate,
      });
      setNarrative(res.narrative);
      setIsOpen(true);
    } catch (err: any) {
      setErrorMsg(
        err.message ?? "AI service unavailable. Deterministic rule explanations remain active.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div
      className={`rounded-lg border border-border bg-surface shadow-2xs overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-container-low/50 transition-colors focus:outline-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-infra-orange" aria-hidden="true" />
          <div>
            <h4 className="text-xs font-semibold text-text-primary">
              AI Plain-Language Narrative (Optional)
            </h4>
            <p className="text-[11px] text-text-muted">
              Plain-language explanation grounded strictly in calculated evidence
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUpIcon className="size-4 text-text-muted" />
        ) : (
          <ChevronDownIcon className="size-4 text-text-muted" />
        )}
      </button>

      {isOpen ? (
        <div className="p-4 pt-1 border-t border-border/40 space-y-3 text-xs">
          {/* Honest Disclaimer Banner */}
          <div className="rounded-md border border-amber-200/80 bg-amber-50/60 p-2.5 text-[11px] text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-200 flex items-start gap-2">
            <AlertCircleIcon className="size-4 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-semibold">AI Advisory Notice:</span> AI-generated plain-language explanation of the calculated indicators — verify against the evidence below.
            </div>
          </div>

          {errorMsg ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-800 text-xs">
              {errorMsg}
            </div>
          ) : null}

          {narrative ? (
            <div className="space-y-3">
              <div className="bg-surface-container-low/60 rounded-lg p-3 text-text-primary leading-relaxed text-xs">
                {narrative.text}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-text-muted pt-1 border-t border-border/30">
                <span>Model: {narrative.model} ({narrative.promptVersion})</span>
                <span>Language: {narrative.language.toUpperCase()}</span>
                <span>Generated: {new Date(narrative.generatedAt).toLocaleString()}</span>
                {narrative.verified ? (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ✓ Verified Grounding
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-2">
              <p className="text-text-muted text-xs">
                No plain-language AI narrative generated yet for this assessment snapshot.
              </p>
            </div>
          )}

          {/* Action and language bar */}
          {canRequest ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/30">
              <div className="flex items-center gap-1.5">
                <span className="text-text-secondary text-[11px]">Language:</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  disabled={isGenerating}
                  className="rounded border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="en">English (en)</option>
                  <option value="si">Sinhala (සිංහල)</option>
                  <option value="ta">Tamil (தமிழ்)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleGenerate(Boolean(narrative))}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 rounded-md bg-infra-orange px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-orange-600 disabled:opacity-50"
              >
                <RefreshCwIcon className={`size-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                <span>
                  {isGenerating
                    ? "Generating…"
                    : narrative
                      ? "Regenerate Narrative"
                      : "Generate AI Narrative"}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
