"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, BookOpenIcon, CheckCircle2Icon, ShieldAlertIcon, DatabaseIcon } from "lucide-react";
import { fetchRiskMethodology } from "@/lib/risk/api";
import { CATEGORY_LABELS, LEVEL_CONFIG } from "@/lib/risk/view";

export function RiskMethodologyClient() {
  const { data: methodology, isLoading } = useQuery({
    queryKey: ["risk", "methodology"],
    queryFn: fetchRiskMethodology,
    staleTime: 300_000,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Breadcrumb / Back link */}
      <div>
        <Link
          href="/risk"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-infra-orange"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
          <span>Back to Risk Intelligence Dashboard</span>
        </Link>
      </div>

      {/* Header & Prominent Honesty Statement */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
            <BookOpenIcon className="size-3.5" aria-hidden="true" />
            Transparent System Architecture
          </span>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs font-mono text-text-muted">
            Engine Version: {methodology?.engineVersion ?? "r1"}
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Risk Intelligence Methodology &amp; Rules Catalog
        </h1>

        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-5 shadow-xs dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <ShieldAlertIcon className="size-5 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
              <h2 className="font-bold text-sm">Auditable Rule-Based Baseline Notice</h2>
              <p className="leading-relaxed">
                {methodology?.honestyStatement ??
                  "This platform implements a deterministic rule-based evaluation baseline grounded in statutory engineering thresholds. It is not an unverified predictive machine learning model. No probability or accuracy claims are made. Every flagged indicator provides verifiable, linked evidence references and transparent formula steps for statutory oversight and audit compliance."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scoring & Index Definitions */}
      <section aria-labelledby="scoring-heading" className="rounded-xl border border-border bg-surface p-6 shadow-2xs space-y-4">
        <h2 id="scoring-heading" className="text-base font-bold text-text-primary">
          Scoring Formulation &amp; Aggregation Logic
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-surface-container-low/40 border border-border/50 space-y-2">
            <h3 className="font-semibold text-text-primary">Rule-points Severity Weights</h3>
            <p className="text-text-muted">
              Triggered indicators contribute rule points according to static severity tiers:
            </p>
            <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
              <span className="rounded bg-sky-50 px-2 py-0.5 text-sky-800 border border-sky-200">
                INFO: 0 pts
              </span>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800 border border-emerald-200">
                LOW: 5 pts
              </span>
              <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800 border border-amber-200">
                MODERATE: 12 pts
              </span>
              <span className="rounded bg-orange-50 px-2 py-0.5 text-orange-800 border border-orange-200">
                HIGH: 25 pts
              </span>
              <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-800 border border-rose-200">
                CRITICAL: 40 pts
              </span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-surface-container-low/40 border border-border/50 space-y-2">
            <h3 className="font-semibold text-text-primary">Level Derivation Rules</h3>
            <ul className="list-disc list-inside space-y-1 text-text-secondary text-[11px]">
              <li><strong>CRITICAL</strong>: Any CRITICAL indicator or Category Index ≥ 70 pts</li>
              <li><strong>HIGH</strong>: Any HIGH indicator or Category Index ≥ 45 pts</li>
              <li><strong>MODERATE</strong>: Any MODERATE indicator or Category Index ≥ 20 pts</li>
              <li><strong>LOW</strong>: Sufficient / Limited data and points &lt; 20 pts</li>
              <li><strong>NOT_ASSESSABLE</strong>: Headline category inputs absent</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Rules Catalog Table */}
      <section aria-labelledby="catalog-heading" className="rounded-xl border border-border bg-surface p-6 shadow-2xs space-y-4">
        <div>
          <h2 id="catalog-heading" className="text-base font-bold text-text-primary">
            Catalog of Risk Indicator Rules
          </h2>
          <p className="text-xs text-text-muted">
            The complete inventory of deterministic indicator rules active in Engine {methodology?.engineVersion ?? "r1"}.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <caption className="sr-only">Catalog of risk indicators</caption>
            <thead>
              <tr className="border-b border-border bg-surface-container-low/50 font-semibold text-text-secondary">
                <th scope="col" className="p-3">Code</th>
                <th scope="col" className="p-3">Category</th>
                <th scope="col" className="p-3">Rule Title</th>
                <th scope="col" className="p-3">Data Source</th>
                <th scope="col" className="p-3">Possible Severities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {(methodology?.rulesCatalog ?? []).map((rule) => (
                <tr key={rule.code} className="hover:bg-surface-container-low/30">
                  <td className="p-3 font-mono font-bold text-infra-orange">{rule.code}</td>
                  <td className="p-3 text-text-secondary">{CATEGORY_LABELS[rule.category] ?? rule.category}</td>
                  <td className="p-3 font-medium text-text-primary">{rule.titleKey}</td>
                  <td className="p-3 text-text-muted font-mono">{rule.dataSourceKey}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                      {rule.severities.map((sev) => (
                        <span key={sev} className="rounded bg-surface-container-low px-1.5 py-0.5 border border-border/50">
                          {sev}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Future Statistical Modeling Readiness Panel */}
      {methodology?.historyStats ? (
        <section aria-labelledby="readiness-heading" className="rounded-xl border border-border bg-surface p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <DatabaseIcon className="size-5 text-infra-orange" aria-hidden="true" />
            <h2 id="readiness-heading" className="text-base font-bold text-text-primary">
              Data Readiness for Statistical Models
            </h2>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            {methodology.historyStats.readinessStatement}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="p-4 rounded-lg bg-surface-container-low/40 border border-border/50">
              <span className="text-text-muted block">Completed Projects Recorded</span>
              <span className="font-mono text-xl font-bold text-text-primary">
                {methodology.historyStats.completedProjectsCount}
              </span>
            </div>
            <div className="p-4 rounded-lg bg-surface-container-low/40 border border-border/50">
              <span className="text-text-muted block">With Verified Actual End Date</span>
              <span className="font-mono text-xl font-bold text-text-primary">
                {methodology.historyStats.completedWithActualEndDateCount}
              </span>
            </div>
            <div className="p-4 rounded-lg bg-surface-container-low/40 border border-border/50">
              <span className="text-text-muted block">Comparable History Sets</span>
              <span className="font-mono text-xl font-bold text-text-primary">
                {methodology.historyStats.comparableSetsAvailable}
              </span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
