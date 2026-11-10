"use client";

import Link from "next/link";
import {
  ExternalLinkIcon,
  MoreVerticalIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useState } from "react";
import type { RiskProjectListItemDto } from "@/lib/risk/types";
import { formatDaysAgo } from "@/lib/risk/view";
import { CategoryStrip } from "./category-strip";
import { FreshnessChip } from "./freshness-chip";
import { LevelChip } from "./level-chip";
import { ResolutionChip } from "./resolution-chip";

export function RiskProjectsTable({
  projects,
  total,
  page = 1,
  limit = 20,
  onPageChange,
  onSelectProject,
  onAssessProject,
  assessingProjectId,
  canAssess = false,
  className = "",
}: {
  projects: RiskProjectListItemDto[];
  total: number;
  page?: number;
  limit?: number;
  onPageChange: (newPage: number) => void;
  onSelectProject: (projectId: string) => void;
  onAssessProject?: (projectId: string) => void;
  assessingProjectId?: string | null;
  canAssess?: boolean;
  className?: string;
}) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const fromIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const toIndex = Math.min(total, page * limit);

  return (
    <div
      className={`rounded-lg border border-border bg-surface shadow-2xs overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Risk-Monitored Infrastructure Projects
          </h3>
          <p className="text-xs text-text-muted">
            Showing {fromIndex}–{toIndex} of {total} assessed projects
          </p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="p-8 text-center space-y-2">
          <p className="text-sm font-medium text-text-secondary">
            No projects match the specified risk criteria.
          </p>
          <p className="text-xs text-text-muted">
            Try adjusting your search query, risk levels, or category filters.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">Project risk intelligence overview</caption>
              <thead>
                <tr className="border-b border-border bg-surface-container-low/50 font-semibold text-text-secondary">
                  <th scope="col" className="p-3">Project</th>
                  <th scope="col" className="p-3">Level</th>
                  <th scope="col" className="p-3">Categories</th>
                  <th scope="col" className="p-3">Headline Risk Trigger</th>
                  <th scope="col" className="p-3">Progress</th>
                  <th scope="col" className="p-3">Last Assessed</th>
                  <th scope="col" className="p-3">Triage</th>
                  <th scope="col" className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {projects.map((p) => {
                  const isAssessing = assessingProjectId === p.projectId;
                  const topInd = p.topIndicators?.[0];

                  return (
                    <tr
                      key={p.projectId}
                      className="hover:bg-surface-container-low/40 transition-colors"
                    >
                      {/* Project title and code */}
                      <td className="p-3 max-w-[220px]">
                        <button
                          type="button"
                          onClick={() => onSelectProject(p.projectId)}
                          className="font-semibold text-text-primary hover:text-infra-orange text-left truncate block w-full focus:outline-none"
                        >
                          {p.title}
                        </button>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-muted mt-0.5">
                          <span>{p.projectCode}</span>
                          {p.agencyName ? (
                            <>
                              <span>·</span>
                              <span>{p.agencyName}</span>
                            </>
                          ) : null}
                        </div>
                      </td>

                      {/* Level */}
                      <td className="p-3 whitespace-nowrap">
                        <LevelChip level={p.overallLevel} size="sm" />
                        {p.overallIndex !== undefined ? (
                          <span
                            className="block text-[10px] text-text-muted mt-0.5 font-mono"
                            title="Rule-points index (not a probability)"
                          >
                            {p.overallIndex} pts
                          </span>
                        ) : null}
                      </td>

                      {/* Category Strip */}
                      <td className="p-3 whitespace-nowrap">
                        <CategoryStrip categories={p.categories} size="sm" />
                      </td>

                      {/* Top Indicator */}
                      <td className="p-3 max-w-[200px]">
                        {topInd ? (
                          <div className="space-y-0.5">
                            <span className="font-mono text-[11px] font-bold text-infra-orange">
                              {topInd.code}
                            </span>
                            <p className="truncate text-text-secondary text-[11px]" title={topInd.titleKey}>
                              {topInd.titleKey}
                            </p>
                          </div>
                        ) : (
                          <span className="text-text-muted italic">None flagged</span>
                        )}
                      </td>

                      {/* Progress Mini Bars */}
                      <td className="p-3 min-w-[120px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-text-secondary font-mono">
                            <span>Phys: {p.physicalProgress}%</span>
                            <span>Fin: {p.financialProgress}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-surface-container-high/50 overflow-hidden relative">
                            <div
                              className="h-full bg-teal-500 absolute left-0 top-0 rounded-full"
                              style={{ width: `${Math.min(100, p.physicalProgress)}%` }}
                              title={`Physical progress: ${p.physicalProgress}%`}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Last Assessed & Freshness */}
                      <td className="p-3 whitespace-nowrap">
                        <FreshnessChip asOf={p.assessedAt} />
                      </td>

                      {/* Triage / Resolution */}
                      <td className="p-3 whitespace-nowrap">
                        <ResolutionChip
                          status={p.resolutionSummary?.openCount > 0 ? "OPEN" : "RESOLVED"}
                          isReopened={p.resolutionSummary?.reopenedCount > 0}
                        />
                      </td>

                      {/* Row Menu Actions */}
                      <td className="p-3 text-right whitespace-nowrap relative">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectProject(p.projectId)}
                            className="rounded p-1 text-text-secondary hover:bg-surface-container-low hover:text-text-primary focus:outline-none"
                            title="Open Project Risk Drawer"
                            aria-label={`Open risk drawer for ${p.projectCode}`}
                          >
                            <SlidersHorizontalIcon className="size-4" />
                          </button>

                          {canAssess && onAssessProject ? (
                            <button
                              type="button"
                              onClick={() => onAssessProject(p.projectId)}
                              disabled={isAssessing}
                              className="rounded p-1 text-text-secondary hover:bg-surface-container-low hover:text-text-primary focus:outline-none disabled:opacity-50"
                              title="Assess Now"
                              aria-label={`Recalculate risk for ${p.projectCode}`}
                            >
                              <RefreshCwIcon className={`size-4 ${isAssessing ? "animate-spin text-infra-orange" : ""}`} />
                            </button>
                          ) : null}

                          <Link
                            href={`/projects/${p.projectId}/overview`}
                            className="rounded p-1 text-text-secondary hover:bg-surface-container-low hover:text-text-primary focus:outline-none"
                            title="Open Project Record"
                            aria-label={`Open project record for ${p.projectCode}`}
                          >
                            <ExternalLinkIcon className="size-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-border/40">
            {projects.map((p) => (
              <div key={p.projectId} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectProject(p.projectId)}
                      className="font-semibold text-sm text-text-primary hover:text-infra-orange text-left"
                    >
                      {p.title}
                    </button>
                    <p className="font-mono text-xs text-text-muted mt-0.5">
                      {p.projectCode} · {p.agencyName ?? p.agencyId}
                    </p>
                  </div>
                  <LevelChip level={p.overallLevel} size="sm" />
                </div>

                <div className="flex items-center justify-between">
                  <CategoryStrip categories={p.categories} size="sm" />
                  <ResolutionChip
                    status={p.resolutionSummary?.openCount > 0 ? "OPEN" : "RESOLVED"}
                    isReopened={p.resolutionSummary?.reopenedCount > 0}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-text-secondary border-t border-border/30 pt-2">
                  <span>Phys: {p.physicalProgress}% · Fin: {p.financialProgress}%</span>
                  <button
                    type="button"
                    onClick={() => onSelectProject(p.projectId)}
                    className="text-infra-orange font-semibold hover:underline"
                  >
                    Inspect Risk →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Bar */}
          <div className="flex items-center justify-between p-3 border-t border-border/50 text-xs text-text-secondary bg-surface-container-low/20">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="rounded border border-border px-2.5 py-1 font-medium hover:bg-surface-container-low disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="rounded border border-border px-2.5 py-1 font-medium hover:bg-surface-container-low disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
