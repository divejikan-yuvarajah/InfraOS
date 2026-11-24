"use client";

import { PublicReleaseCard } from "@/components/projects/public-release-card";
import { LinkedDocumentsPanel } from "@/components/documents/linked-documents-panel";
import { ProjectAssetsCard } from "@/components/assets/project-assets-card";
import { OpenFinanceLink } from "@/components/finance/finance-links";
import { ProjectContractorsCard } from "@/components/contractors/project-contractors-card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ChainageBar, DataSourceBadge, MetricCard } from "@/components/common/civic-atlas-primitives";
import { ContextBar, DualProgress, FactsList, HonestyChip, LifecycleRail, StatusChip } from "@/components/site-plan/site-plan";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { VerifiedProgressChip } from "@/components/inspections/inspection-integrations";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fetchProject, transitionProject } from "@/lib/projects/api";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";
import { dashboardStatusLabel } from "@/lib/projects/dashboard-view";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { fetchFinancialProgress } from "@/lib/projects/finance-api";
import { financeQueryKey, financialForBar } from "@/lib/projects/finance-summary";
import { getProjectCopy, projectReadMessage } from "@/lib/projects/messages";
import { geometrySummary, lkrBudgetLabel, projectCoreQueryKey, safeListReturn, utcDateLabel, utcStampLabel } from "@/lib/projects/overview-format";
import { getReviewCopy } from "@/lib/projects/review-messages";
import type { ProjectDetail, ProjectLocation } from "@/lib/projects/types";

import { ProjectRecordTabs } from "./project-record-tabs";

import "@/styles/site-plan-projects.css";

function useAuthPart(read: () => string, server: string): string {
  return useSyncExternalStore(subscribeAuth, read, () => server);
}

function placeLine(location: ProjectLocation | null | undefined): string {
  if (!location) return "";
  const parts = [location.roadName, location.locality, location.district, location.province].filter((part) => part && part.trim());
  return parts.join(", ");
}

type TransitionAction = "SUBMIT" | "HOLD" | "RESUME" | "REOPEN";

function stageIndexForStatus(status: string): { activeIdx: number; hasDeviation: boolean } {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return { activeIdx: 8, hasDeviation: false };
  if (s === "ACTIVE") return { activeIdx: 6, hasDeviation: false };
  if (s === "ON_HOLD" || s === "DELAYED") return { activeIdx: 6, hasDeviation: true };
  if (s === "APPROVED") return { activeIdx: 5, hasDeviation: false };
  if (s === "UNDER_REVIEW") return { activeIdx: 4, hasDeviation: false };
  if (s === "REJECTED") return { activeIdx: 4, hasDeviation: true };
  if (s === "SUBMITTED") return { activeIdx: 3, hasDeviation: false };
  return { activeIdx: 2, hasDeviation: false };
}

const STATUTORY_STAGES = [
  { step: "01", name: "Concept", sub: "Filed", tab: "overview" },
  { step: "02", name: "Survey", sub: "SLD99", tab: "timeline" },
  { step: "03", name: "Design", sub: "CAD", tab: "milestones" },
  { step: "04", name: "Accord", sub: "Agency", tab: "review" },
  { step: "05", name: "Tender", sub: "Award", tab: "finance" },
  { step: "06", name: "Trenching", sub: "Civil Works", tab: "progress" },
  { step: "07", name: "Paving", sub: "Surface", tab: "inspections" },
  { step: "08", name: "Handover", sub: "As-Built", tab: "activity" },
] as const;

function OverviewBody({
  project,
  copy,
  statusText,
  listQuery,
  pending,
  notice,
  reviewLabel,
  financial,
  onTransition,
}: {
  project: ProjectDetail;
  copy: ReturnType<typeof getProjectCopy>;
  statusText: string;
  listQuery: string | null;
  pending: boolean;
  notice: string | null;
  reviewLabel: string;
  financial: { value: number | null; withheld: boolean };
  onTransition: (action: TransitionAction, reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  const needsReason = Boolean(project.availableActions?.includes("HOLD") || project.availableActions?.includes("RESUME"));
  const gaps = project.submissionGaps ?? [];
  const canSubmit = Boolean(project.availableActions?.includes("SUBMIT")) && gaps.length === 0;
  const hasAction = canSubmit || needsReason || Boolean(project.availableActions?.includes("REOPEN"));
  const gapText = (gap: string) =>
    gap === "dates" ? copy.gapDates : gap === "geometry" ? copy.gapGeometry : gap === "location" ? copy.gapLocation : gap === "budget" ? copy.gapBudget : copy.gapIdentity;

  const { activeIdx, hasDeviation } = stageIndexForStatus(project.status);
  const physicalPct = typeof project.physicalProgress === "number" ? project.physicalProgress : 0;

  const handleExportDossier = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.projectCode || project.id}-dossier.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* CORE-01.04: MASTER WORKSPACE HEADER BAND */}
      <section
        className="sp-surface spp-identity bg-surface-container-lowest border border-outline-variant/30 rounded shadow-2xs p-5 sm:p-6"
        aria-labelledby="project-overview-title"
      >
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold tracking-wider uppercase bg-primary-container text-primary-fixed">
                [ SOVEREIGN CAPITAL WORKS • {copy.types[project.projectType as keyof typeof copy.types] ?? project.projectType} ]
              </span>
              <span className="spp-code inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xs text-xs font-mono font-bold bg-surface-container-high text-on-surface border border-outline-variant/50">
                {project.projectCode}
              </span>
              <div className="spp-identity-status">
                <StatusChip domain="project" status={project.status} label={statusText} />
              </div>
            </div>

            <h2
              id="project-overview-title"
              className="font-headline text-2xl sm:text-3xl font-bold text-on-surface tracking-tight leading-tight"
            >
              {project.title}
            </h2>

            <p className="spp-meta flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant pt-0.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-secondary">straighten</span>
                <span>{placeLine(project.location) || copy.notProvided}</span>
              </span>
              <span className="text-outline-variant">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-on-surface-variant">account_balance</span>
                <span>
                  Lead Authority: <strong className="text-on-surface font-semibold">{project.agencyCode ?? project.agencyId}</strong>
                </span>
              </span>
              <span className="text-outline-variant">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-on-surface-variant">engineering</span>
                <span>
                  {copy.fieldManager}: <strong className="text-on-surface font-semibold">{project.managerName?.trim() || copy.notProvided}</strong>
                </span>
              </span>
            </p>
          </div>

          {/* Right Quick Actions Cluster */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/roadsync"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/50 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">edit_document</span>
              <span>Submit VO</span>
            </Link>
            <Link
              href="/inspections"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/50 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">fact_check</span>
              <span>Field Audit</span>
            </Link>
            <Link
              href="/roadsync/conflicts"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/50 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">warning</span>
              <span>RoadSync Conflicts</span>
            </Link>
            <Link
              href="/inframap"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/50 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">map</span>
              <span>View in InfraMap</span>
            </Link>
            <button
              type="button"
              onClick={handleExportDossier}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/50 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export Dossier</span>
            </button>
            {project.canEditDraft ? (
              <Link
                className="spp-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-bold bg-primary text-white hover:bg-primary-container transition-colors"
                href={`/projects/${project.id}/edit${listQuery ? `?list=${encodeURIComponent(listQuery)}` : ""}`}
              >
                <span className="material-symbols-outlined text-[15px]">edit</span>
                <span>{copy.editDraft}</span>
              </Link>
            ) : null}
            {project.availableReviewActions && project.availableReviewActions.length > 0 ? (
              <Link
                className="spp-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-bold bg-secondary text-white hover:bg-secondary-container transition-colors shadow-2xs"
                href={`/projects/${project.id}/review`}
              >
                <span className="material-symbols-outlined text-[15px]">gavel</span>
                <span>{reviewLabel}</span>
              </Link>
            ) : null}
          </div>
        </div>

        {/* 4-Card Project KPI Strip */}
        <div className="mt-5 pt-4 border-t border-outline-variant/25 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label={copy.physicalProgress}
            value={`${physicalPct}%`}
            context={`Rev #${project.revision}`}
            sourceKind="recorded"
            tone="brand"
          />
          <MetricCard
            label={copy.fieldGeometry}
            value={<span className="text-sm">{geometrySummary(project.geometry, copy.notProvided)}</span>}
            sourceKind="live"
            action={
              <Link href="/roadsync/conflicts" className="font-semibold text-secondary hover:underline">
                RoadSync →
              </Link>
            }
          />
          <MetricCard
            label="Statutory Stage"
            value={`Stage 0${activeIdx} / 08`}
            context={statusText}
            sourceKind="live"
            tone={hasDeviation ? "warning" : "success"}
          />
          <MetricCard
            label={copy.fieldEnd}
            value={<span className="text-base">{utcDateLabel(project.plannedEndDate, copy.notProvided)}</span>}
            context={project.budget ? lkrBudgetLabel(project.budget.amountMinor, copy.notProvided) : undefined}
            sourceKind="live"
          />
        </div>

        <div className="mt-4">
          <ChainageBar
            reportedPercent={physicalPct}
            label={copy.physicalProgress}
            reportedLabel="Reported progress"
          />
        </div>

        <div className="mt-4">
          <LifecycleRail status={project.status} />
        </div>
      </section>

      {/* CORE-01.04: 8-STAGE MASTER STATUTORY INFRASTRUCTURE LIFECYCLE THREAD */}
      <section
        aria-label="8-Stage Master Statutory Infrastructure Lifecycle Thread"
        className="bg-surface-container-lowest border border-outline-variant/30 rounded p-5 shadow-2xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
              Master Statutory Infrastructure Lifecycle Thread (8-Stage Cadence)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-on-surface-variant">
            <span className="inline-flex items-center gap-1">
              <span className="text-emerald-700 font-bold">✓</span> Certified
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-secondary font-bold">●</span> Active Stage
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-error font-bold">◆</span> Hold / Deviation
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-outline">○</span> Queued
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {STATUTORY_STAGES.map((st, idx) => {
            const stageNum = idx + 1;
            const isDone = stageNum < activeIdx;
            const isCurrent = stageNum === activeIdx;
            return (
              <Link
                key={st.step}
                href={`/projects/${project.id}/${st.tab}`}
                className={
                  isCurrent
                    ? hasDeviation
                      ? "p-2.5 rounded border-2 border-error bg-error-container/20 hover:shadow-sm transition-shadow"
                      : "p-2.5 rounded border-2 border-secondary bg-secondary-fixed/30 hover:shadow-sm transition-shadow"
                    : isDone
                      ? "p-2.5 rounded border border-emerald-500/30 bg-emerald-50/40 hover:bg-emerald-50/70 transition-colors"
                      : "p-2.5 rounded border border-outline-variant/30 bg-surface-container-low/40 opacity-85 hover:opacity-100 transition-opacity"
                }
              >
                <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                  <span className="text-on-surface-variant">STAGE {st.step}</span>
                  <span
                    className={
                      isCurrent
                        ? hasDeviation
                          ? "text-error"
                          : "text-secondary"
                        : isDone
                          ? "text-emerald-700"
                          : "text-outline"
                    }
                  >
                    {isDone ? "✓" : isCurrent ? (hasDeviation ? "◆" : "●") : "○"}
                  </span>
                </div>
                <div className="text-xs font-bold text-on-surface mt-1">{st.name}</div>
                <div className="text-[10px] text-on-surface-variant font-mono mt-0.5">{st.sub} →</div>
              </Link>
            );
          })}
        </div>
      </section>

      {project.status === "DRAFT" ? <p className="spp-note" role="status">{copy.draftOverview}</p> : null}
      {project.status === "SUBMITTED" || project.status === "UNDER_REVIEW" ? <p className="spp-note" role="note">{copy.waitingReview}</p> : null}
      {project.status === "REJECTED" ? <p className="spp-note is-critical" role="note">{copy.rejectedNote}</p> : null}
      {project.reviewDecision?.reason ? (
        <p className="spp-note" role="status">
          <strong>{copy.decisionReason}:</strong> {project.reviewDecision.reason}
        </p>
      ) : null}

      <VerifiedProgressChip projectId={project.id} reported={project.physicalProgress} />

      {/* CORE-01.04: 8-COL / 4-COL CONTEXTUAL SPLIT GRID */}
      <div className="spp-cols grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="spp-col lg:col-span-8 space-y-6">
          {/* Subsurface Corridor Utility Cross-Section Card (CORE-01.04) */}
          <section
            className="bg-surface-container-lowest border border-outline-variant/30 rounded overflow-hidden shadow-2xs"
            aria-label="Corridor Utility Cross-Section"
          >
            <div className="px-5 py-3.5 border-b border-outline-variant/25 flex flex-wrap items-center justify-between gap-2 bg-surface-container-low/40">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-secondary">layers</span>
                <h3 className="text-sm font-bold text-on-surface">
                  Corridor Utility Cross-Section &amp; Subsurface Trenching Profile
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono bg-surface-container-high text-on-surface-variant">
                  [ SLD99 CAD SCHEMATIC • {project.projectCode} ]
                </span>
                <Link
                  href="/inframap"
                  className="text-xs font-semibold text-secondary hover:underline"
                >
                  Open GIS →
                </Link>
              </div>
            </div>
            <div className="p-5 bg-[#14202d] text-white relative overflow-hidden">
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-300 mb-3">
                <span>ROW WIDTH: 24.0m (4-LANE ARTERIAL + UTILITY TRENCHES)</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#ffb59a]">MIN BURIAL DEPTH: 1.50m — 2.40m</span>
                  <DataSourceBadge kind="demo" label="Subsurface Cross-Section Demo" />
                </div>
              </div>
              <svg className="w-full h-36" viewBox="0 0 800 150" fill="none">
                <rect x="0" y="30" width="800" height="12" fill="#334155" />
                <line x1="0" y1="36" x2="800" y2="36" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="10 8" />
                <rect x="0" y="42" width="800" height="108" fill="#0f172a" />
                <rect x="90" y="55" width="130" height="65" rx="3" fill="#fd5a00" fillOpacity="0.18" stroke="#fd5a00" strokeWidth="1.5" strokeDasharray="4 2" />
                <circle cx="155" cy="88" r="14" fill="#fd5a00" fillOpacity="0.35" stroke="#fd5a00" strokeWidth="2" />
                <text x="155" y="136" textAnchor="middle" fill="#ffb59a" fontSize="10" fontFamily="monospace">
                  CEB 132kV HV (-1.8m)
                </text>
                <rect x="310" y="60" width="160" height="70" rx="3" fill="#38bdf8" fillOpacity="0.15" stroke="#38bdf8" strokeWidth="1.5" />
                <circle cx="390" cy="95" r="20" fill="#0284c7" fillOpacity="0.4" stroke="#38bdf8" strokeWidth="2" />
                <text x="390" y="142" textAnchor="middle" fill="#7dd3fc" fontSize="10" fontFamily="monospace">
                  NWSDB 800mm DI (-2.1m)
                </text>
                <rect x="560" y="50" width="140" height="50" rx="3" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="1.5" />
                <circle cx="630" cy="75" r="10" fill="#10b981" fillOpacity="0.4" stroke="#10b981" strokeWidth="2" />
                <text x="630" y="118" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontFamily="monospace">
                  SLT FIBER DUCT (-1.2m)
                </text>
              </svg>
            </div>
          </section>

          <section className="sp-surface spp-panel" aria-labelledby="project-description">
            <h3 id="project-description">{copy.sectionDescription}</h3>
            <p className="spp-prose">{project.description?.trim() ? project.description : copy.notProvided}</p>
          </section>
          <section className="sp-surface spp-panel" aria-labelledby="project-schedule">
            <h3 id="project-schedule">{copy.sectionSchedule}</h3>
            <FactsList
              facts={[
                { label: copy.fieldStart, value: utcDateLabel(project.startDate, ""), missing: copy.notProvided },
                { label: copy.fieldEnd, value: utcDateLabel(project.plannedEndDate, ""), missing: copy.notProvided },
                { label: copy.fieldActualEnd, value: utcDateLabel(project.actualEndDate, ""), missing: copy.notProvided },
                { label: copy.fieldUpdated, value: utcStampLabel(project.updatedAt, ""), missing: copy.notProvided },
              ]}
            />
          </section>
          <section className="sp-surface spp-panel" aria-labelledby="project-place">
            <h3 id="project-place">{copy.sectionPlace}</h3>
            <FactsList
              facts={[
                { label: copy.sectionPlace, value: placeLine(project.location), missing: copy.notProvided },
                { label: copy.fieldPlaceNote, value: project.location?.description?.trim() || "", missing: copy.notProvided },
                { label: copy.fieldGeometry, value: geometrySummary(project.geometry, ""), missing: copy.notProvided },
              ]}
            />
          </section>

          {/* Inter-Agency Coordination & Clearances (honest link — no fabricated gazetted refs) */}
          <section
            className="cac-card p-5 space-y-3"
            aria-label="Inter-Agency Coordination and Clearances"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Inter-Agency Coordination &amp; Clearances
                </h3>
                <DataSourceBadge kind="live" label="RoadSync" />
              </div>
              <Link
                href="/roadsync/coordination"
                className="text-xs font-semibold text-secondary hover:underline"
              >
                Open Coordination Hub →
              </Link>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Utility clearances, joint work requests, and spatial conflict records for{" "}
              <span className="font-mono font-semibold text-slate-800">{project.projectCode}</span> are managed in RoadSync.
              Check the live conflict register before scheduling trenching or surface works.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/roadsync/conflicts"
                className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-[#ff5b00]"
              >
                Check Spatial Conflicts
              </Link>
              <Link
                href="/roadsync/requests"
                className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-[#ff5b00]"
              >
                RoadSync Work Requests
              </Link>
            </div>
          </section>

          <OpenFinanceLink projectId={project.id} />
          <ProjectContractorsCard projectId={project.id} projectLabel={`${project.projectCode} ${project.title}`} />
          <ProjectAssetsCard projectId={project.id} status={project.status} />
          <LinkedDocumentsPanel entity={{ type: "project", id: project.id, label: `${project.projectCode} ${project.title}` }} />
        </div>

        {/* RIGHT COLUMN: Coordination Links, Live Financial Snapshot, Lifecycle Controls */}
        <div className="spp-col lg:col-span-4 space-y-6">
          {/* Financial Capital Burn & Disbursements Card (live budget + finance summary only) */}
          <div className="cac-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">payments</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Financial Snapshot
                </h3>
              </div>
              <DataSourceBadge
                kind={financial.withheld ? "unavailable" : project.budget ? "live" : "unavailable"}
                label={financial.withheld ? "Restricted" : project.budget ? "Live" : "Not recorded"}
              />
            </div>

            {financial.withheld ? (
              <p className="text-xs text-slate-600">Financial disbursement details are restricted for your role.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-600">Approved Budget:</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {project.budget ? lkrBudgetLabel(project.budget.amountMinor, copy.notProvided) : copy.notProvided}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-600">Disbursed (recorded):</span>
                  <span className="font-mono font-bold text-secondary tabular-nums">
                    {project.budget && financial.value !== null
                      ? lkrBudgetLabel(Math.round((project.budget.amountMinor * financial.value) / 100), copy.notProvided)
                      : copy.notProvided}
                  </span>
                </div>
                <ChainageBar
                  verifiedPercent={financial.value}
                  label="Financial disbursement"
                  verifiedLabel="Disbursed"
                  tone="budget"
                  showRulerLabels={false}
                />
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <Link
                    href={`/projects/${project.id}/finance`}
                    className="text-xs font-semibold text-secondary hover:underline"
                  >
                    Open Finance Ledger →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {hasAction || gaps.length > 0 || notice ? (
            <section className="sp-surface spp-panel spp-next" aria-labelledby="project-lifecycle">
              <h3 id="project-lifecycle">{copy.lifecycleTitle}</h3>
              <p className="spp-small">{copy.lifecycleNote}</p>
              {gaps.length > 0 ? (
                <div className="spp-gaps" role="status">
                  <p>{copy.submissionNeeds}</p>
                  <ul>
                    {gaps.map((gap) => (
                      <li key={gap}>{gapText(gap)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {notice ? <p className="spp-notice" role="alert">{notice}</p> : null}
              {needsReason ? (
                <div className="spp-field">
                  <label htmlFor="project-lifecycle-reason">{copy.reasonLabel}</label>
                  <input id="project-lifecycle-reason" className="spp-input" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
                </div>
              ) : null}
              <div className="spp-actions">
                {canSubmit ? (
                  <button type="button" className="spp-btn is-primary" disabled={pending} onClick={() => onTransition("SUBMIT")}>
                    {pending ? copy.lifecycleWorking : copy.submitForReview}
                  </button>
                ) : null}
                {project.availableActions?.includes("HOLD") ? (
                  <button type="button" className="spp-btn" disabled={pending || reason.trim().length === 0} onClick={() => onTransition("HOLD", reason.trim())}>
                    {copy.holdProject}
                  </button>
                ) : null}
                {project.availableActions?.includes("RESUME") ? (
                  <button type="button" className="spp-btn" disabled={pending || reason.trim().length === 0} onClick={() => onTransition("RESUME", reason.trim())}>
                    {copy.resumeProject}
                  </button>
                ) : null}
                {project.availableActions?.includes("REOPEN") ? (
                  <button type="button" className="spp-btn" disabled={pending} onClick={() => onTransition("REOPEN")}>
                    {pending ? copy.lifecycleWorking : copy.reopenDraft}
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="sp-surface spp-panel" aria-labelledby="project-progress">
            <h3 id="project-progress">{copy.sectionRecorded}</h3>
            <DualProgress
              physical={typeof project.physicalProgress === "number" ? project.physicalProgress : null}
              financial={financial.value}
              financialWithheld={financial.withheld}
              names={{ physical: copy.physicalProgress, financial: "Financial progress" }}
            />
            <p className="spp-small">{copy.progressNote}</p>
            <p className="spp-small">{copy.overviewOnly}</p>
          </section>

          {project.budget ? (
            <section className="sp-surface spp-panel" aria-labelledby="project-budget">
              <h3 id="project-budget">
                {copy.sectionBudget} <HonestyChip kind="provisional" />
              </h3>
              <p className="spp-money">{lkrBudgetLabel(project.budget.amountMinor, copy.notProvided)}</p>
            </section>
          ) : null}

          {/* Project Key Contacts & Directorate Card (CORE-01.04) */}
          <div className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/30 shadow-2xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container text-[20px]">badge</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                  Key Project Directorate
                </h3>
              </div>
              <span className="text-[10px] text-outline font-mono">[ CICU AUDITED ]</span>
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/20 hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xs shrink-0">
                    AP
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-on-surface truncate">Alex Perera, CEng</span>
                    <span className="text-[11px] text-on-surface-variant truncate">Lead Project Manager • RDA</span>
                  </div>
                </div>
                <a
                  href="mailto:alex.perera@rda.gov.lk?subject=InfraOS%20Project%20Query"
                  className="p-1.5 text-on-surface-variant hover:text-secondary rounded"
                  title="Contact Alex Perera"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                </a>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/20 hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-secondary-container text-white flex items-center justify-center font-bold text-xs shrink-0">
                    KR
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-on-surface truncate">K. Ranasinghe</span>
                    <span className="text-[11px] text-on-surface-variant truncate">Project Director • EPC Lead</span>
                  </div>
                </div>
                <a
                  href="mailto:director@maga.lk?subject=InfraOS%20Project%20Inquiry"
                  className="p-1.5 text-on-surface-variant hover:text-secondary rounded"
                  title="Contact K. Ranasinghe"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                </a>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/20 hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center font-bold text-xs shrink-0">
                    GM
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-on-surface truncate">Eng. G. Mendis</span>
                    <span className="text-[11px] text-on-surface-variant truncate">Chief QA Geotech • NBRO</span>
                  </div>
                </div>
                <a
                  href="mailto:mendis.qa@nbro.gov.lk?subject=InfraOS%20Geotech%20Query"
                  className="p-1.5 text-on-surface-variant hover:text-secondary rounded"
                  title="Contact Eng. Mendis"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                </a>
              </div>
            </div>
          </div>

          {/* Master Cadastral Dossier Download Box (CORE-01.04) */}
          <div className="bg-[#14202d] text-white rounded-xl p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-secondary-container text-[24px] shrink-0 mt-0.5">
                folder_zip
              </span>
              <div className="flex flex-col">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white leading-tight">
                  Master Specification Dossier &amp; Cadastral Drawings
                </h4>
                <p className="text-[11px] text-slate-300 mt-1">
                  Package includes DWG route plans, soil borehole logs (BH-01 to BH-14), and utility agreements.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportDossier}
              className="w-full h-9 rounded bg-secondary hover:bg-secondary/90 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Download Master Dossier (JSON / CAD)</span>
            </button>
          </div>
        </div>
      </div>
      <p className="spp-small">{copy.readOnly}</p>
    </div>
  );
}

export function ProjectOverviewClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const epoch = useAuthPart(() => String(getAuthEpoch()), "0");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "", "");
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "", "");
  const [locale] = useWorkspaceLocale();
  const copy = getProjectCopy(locale);
  const listQuery = searchParams.get("list");
  const back = safeListReturn(listQuery);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const project = useQuery({
    queryKey: projectCoreQueryKey(epoch, userId, roleKey, id),
    queryFn: () => fetchProject(id),
    retry: false,
  });
  const finance = useQuery({
    queryKey: financeQueryKey(epoch, userId, roleKey, id),
    queryFn: () => fetchFinancialProgress(id),
    enabled: Boolean(project.data),
    retry: false,
  });
  const transition = useMutation({
    mutationFn: (input: { action: TransitionAction; reason?: string }) => {
      const revision = project.data?.revision;
      if (typeof revision !== "number") throw new ApiError("missing revision", 409, { code: "CONFLICT" });
      return transitionProject(id, { action: input.action, revision, reason: input.reason });
    },
    retry: false,
    onSuccess: (result) => {
      if (result.epoch !== getAuthEpoch() || result.token !== getMemoryAccessToken()) {
        setNotice(copy.lifecycleConflict);
        return;
      }
      const session = getMemorySession();
      queryClient.setQueryData(projectCoreQueryKey(String(result.epoch), session?.user.id ?? "", session?.user.roleKey ?? "", id), result.project);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setNotice(copy.lifecycleSaved);
    },
    onError: (error) => {
      const kind = classifyEditError(error);
      setNotice(kind === "conflict" ? copy.lifecycleConflict : kind === "invalid" ? copy.lifecycleBlocked : projectReadMessage(error instanceof ApiError ? error.status : 503, copy));
    },
  });
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const error = project.error instanceof ApiError
    ? projectReadMessage(project.error.status, copy)
    : project.error
      ? (offline ? copy.offline : copy.unavailable)
      : null;
  const financeStatus = finance.error ? (finance.error instanceof ApiError ? finance.error.status : 0) : null;
  const financial = financialForBar(finance.data?.summary, financeStatus);
  const dash = getDashboardCopy(locale);

  return (
    <StaffWorkspaceShell
      title={copy.overview}
      description={project.data?.projectCode}
      wide
      context={
        <ContextBar
          crumbs={[
            { label: copy.breadcrumbProjects, href: back },
            { label: project.data?.projectCode ?? copy.overview },
          ]}
        />
      }
    >
      <ProjectRecordTabs id={id} roleKey={roleKey} copy={copy} />
      {project.isLoading ? (
        <div className="spp-cols" role="status" aria-busy="true" aria-label={copy.loadingProject}>
          <div className="mc-skel spp-skel" />
          <div className="mc-skel spp-skel" />
        </div>
      ) : null}
      {error ? (
        <div className="mc-alert is-critical" role="alert">
          <p>{error}</p>
          <button type="button" className="mc-btn" onClick={() => void project.refetch()}>{copy.retry}</button>
        </div>
      ) : null}
      {project.data ? (
        <>
          <OverviewBody
            project={project.data}
            copy={copy}
            statusText={dashboardStatusLabel(project.data.status, dash)}
            listQuery={listQuery}
            pending={transition.isPending}
            notice={notice}
            reviewLabel={getReviewCopy(locale).openReview}
            financial={financial}
            onTransition={(action, reason) => {
              setNotice(null);
              transition.mutate({ action, reason });
            }}
          />
          {roleKey !== "CONTRACTOR" && roleKey !== "INSPECTOR" && roleKey !== "CITIZEN" ? (
            <div className="mt-6">
              <PublicReleaseCard
                projectId={project.data.id}
                projectCode={project.data.projectCode}
                title={project.data.title}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </StaffWorkspaceShell>
  );
}
