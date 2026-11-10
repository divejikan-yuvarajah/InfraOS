"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DownloadIcon,
  PlayIcon,
  BookOpenIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { getMemorySession, subscribeAuth } from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import {
  assessAllProjects,
  assessProjectOnDemand,
  fetchProjectResolutions,
  fetchProjectRisk,
  fetchRiskOverview,
  fetchRiskPortfolioTrend,
  fetchRiskProjects,
  fetchRiskRuns,
  fetchRiskScatter,
  getRiskExportCsvUrl,
} from "@/lib/risk/api";
import { buildRiskQueryString, parseRiskQueryParams } from "@/lib/risk/list-query";
import { getRiskCopy } from "@/lib/risk/messages";
import { canHintRisk, canResolveRisk } from "@/lib/risk/session";
import type { RiskListFilters, RiskProjectListItemDto } from "@/lib/risk/types";
import { formatDaysAgo } from "@/lib/risk/view";

import { CategoryBreakdown } from "./category-breakdown";
import { FinVsPhysChart } from "./fin-vs-phys-chart";
import { PortfolioTrendChart } from "./portfolio-trend-chart";
import { RiskDetailDrawer } from "./risk-detail-drawer";
import { RiskFilters } from "./risk-filters";
import { RiskProjectsTable } from "./risk-projects-table";
import { SeverityCards } from "./severity-cards";
import { SourceAvailabilityBanner } from "./source-availability-banner";

export function RiskDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [locale] = useWorkspaceLocale();
  const copy = getRiskCopy(locale);

  const session = useSyncExternalStore(subscribeAuth, getMemorySession, () => null);
  const roleKey = session?.user?.roleKey ?? "";
  const canAssess = canHintRisk(roleKey);
  const canResolve = canResolveRisk(roleKey);

  const [filters, setFilters] = useState<RiskListFilters>(() =>
    parseRiskQueryParams(searchParams),
  );

  // Selected project for detail drawer
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [assessingProjectId, setAssessingProjectId] = useState<string | null>(null);

  // Bulk assess run status
  const [isBulkAssessing, setIsBulkAssessing] = useState(false);
  const [bulkRunMsg, setBulkRunMsg] = useState<string | null>(null);

  // 1. Fetch Overview metrics
  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: ["risk", "overview"],
    queryFn: fetchRiskOverview,
    staleTime: 30_000,
  });

  // 2. Fetch Projects list
  const queryString = buildRiskQueryString(filters);
  const { data: projectsData, isLoading: isProjectsLoading, refetch: refetchProjects } = useQuery({
    queryKey: ["risk", "projects", queryString],
    queryFn: () => fetchRiskProjects(queryString),
    staleTime: 15_000,
  });

  // 3. Fetch Scatter data
  const { data: scatterData } = useQuery({
    queryKey: ["risk", "scatter"],
    queryFn: fetchRiskScatter,
    staleTime: 60_000,
  });

  // 4. Fetch Portfolio Trend
  const { data: trendData } = useQuery({
    queryKey: ["risk", "trend"],
    queryFn: () => fetchRiskPortfolioTrend("12w"),
    staleTime: 60_000,
  });

  // 5. Fetch Recent Runs
  const { data: runsData } = useQuery({
    queryKey: ["risk", "runs"],
    queryFn: fetchRiskRuns,
    staleTime: 30_000,
  });

  // 6. Selected project risk query
  const { data: selectedProjectRisk, refetch: refetchSelectedRisk } = useQuery({
    queryKey: ["risk", "project", selectedProjectId],
    queryFn: () => fetchProjectRisk(selectedProjectId!),
    enabled: Boolean(selectedProjectId),
  });

  // 7. Selected project resolutions query
  const { data: selectedProjectResolutions, refetch: refetchSelectedResolutions } = useQuery({
    queryKey: ["risk", "resolutions", selectedProjectId],
    queryFn: () => fetchProjectResolutions(selectedProjectId!),
    enabled: Boolean(selectedProjectId),
  });

  // Synchronize URL query params
  useEffect(() => {
    const qs = buildRiskQueryString(filters);
    const target = qs ? `/risk?${qs}` : "/risk";
    router.replace(target, { scroll: false });
  }, [filters, router]);

  function handleFilterChange(updated: Partial<RiskListFilters>) {
    setFilters((prev) => ({ ...prev, ...updated }));
  }

  function handleResetFilters() {
    setFilters({ page: 1, limit: 20 });
  }

  async function handleAssessProject(projectId: string) {
    setAssessingProjectId(projectId);
    try {
      await assessProjectOnDemand(projectId, true);
      queryClient.invalidateQueries({ queryKey: ["risk"] });
      if (selectedProjectId === projectId) {
        refetchSelectedRisk();
      }
    } catch (err: any) {
      console.error("Assessment failed:", err);
    } finally {
      setAssessingProjectId(null);
    }
  }

  async function handleBulkAssess() {
    setIsBulkAssessing(true);
    setBulkRunMsg(null);
    try {
      const res = await assessAllProjects();
      setBulkRunMsg(`Bulk run initiated (Run ID: ${res.runId}). Evaluating portfolio…`);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["risk"] });
        setIsBulkAssessing(false);
      }, 3000);
    } catch (err: any) {
      setBulkRunMsg(err.message ?? "Bulk assessment request failed.");
      setIsBulkAssessing(false);
    }
  }

  const latestRun = runsData?.items?.[0];

  return (
    <StaffWorkspaceShell
      title={copy.dashboardTitle}
      description={copy.dashboardSub}
      wide
      hidePageHeader
    >
      <div className="space-y-6 pb-12">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
                <ShieldAlertIcon className="size-3.5" aria-hidden="true" />
                Explainable Risk Engine
              </span>
              <span className="text-xs text-text-muted">·</span>
              <span className="text-xs font-mono text-text-muted">
                {latestRun ? `Last Run: ${formatDaysAgo(latestRun.finishedAt ?? latestRun.startedAt)}` : "No runs recorded"}
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary mt-1">
              {copy.dashboardTitle}
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              {copy.honesty.notPredictionModel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canAssess ? (
              <button
                type="button"
                onClick={handleBulkAssess}
                disabled={isBulkAssessing}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-container-low disabled:opacity-50"
              >
                <RefreshCwIcon className={`size-3.5 ${isBulkAssessing ? "animate-spin text-infra-orange" : ""}`} />
                <span>{isBulkAssessing ? copy.header.assessingAll : copy.header.assessAll}</span>
              </button>
            ) : null}

            <a
              href={getRiskExportCsvUrl()}
              download="risk-intelligence-export.csv"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-container-low hover:text-text-primary"
            >
              <DownloadIcon className="size-3.5" aria-hidden="true" />
              <span>{copy.header.exportCsv}</span>
            </a>

            <Link
              href="/risk/methodology"
              className="inline-flex items-center gap-1.5 rounded-md bg-infra-orange px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-orange-600"
            >
              <BookOpenIcon className="size-3.5" aria-hidden="true" />
              <span>{copy.header.methodology}</span>
            </Link>
          </div>
        </div>

        {bulkRunMsg ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
            {bulkRunMsg}
          </div>
        ) : null}

        {/* Source Availability Banner */}
        <SourceAvailabilityBanner sourceFreshness={overview?.sourceNotices as any} />

        {/* Severity Metrics Cards */}
        <SeverityCards
          overview={overview}
          selectedLevel={filters.level}
          isStaleFilter={filters.stale}
          isUnacknowledgedFilter={filters.resolution === "unacknowledged"}
          onSelectLevel={(lvl) => handleFilterChange({ level: lvl, page: 1 })}
          onToggleStale={() => handleFilterChange({ stale: filters.stale ? undefined : true, page: 1 })}
          onToggleUnacknowledged={() =>
            handleFilterChange({
              resolution: filters.resolution === "unacknowledged" ? undefined : "unacknowledged",
              page: 1,
            })
          }
        />

        {/* Visual Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <FinVsPhysChart
              points={scatterData?.points}
              onSelectProject={(id) => setSelectedProjectId(id)}
            />
          </div>
          <div className="space-y-6">
            <CategoryBreakdown
              overview={overview}
              selectedCategory={filters.category}
              onSelectCategory={(cat) => handleFilterChange({ category: cat, page: 1 })}
            />
            <PortfolioTrendChart
              points={trendData?.points}
              insufficientHistory={trendData?.insufficientHistory}
            />
          </div>
        </div>

        {/* Filters Bar */}
        <RiskFilters
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {/* Main High-Risk Projects Table */}
        <RiskProjectsTable
          projects={projectsData?.items ?? []}
          total={projectsData?.pagination?.total ?? 0}
          page={filters.page ?? 1}
          limit={filters.limit ?? 20}
          onPageChange={(p) => handleFilterChange({ page: p })}
          onSelectProject={(id) => setSelectedProjectId(id)}
          onAssessProject={handleAssessProject}
          assessingProjectId={assessingProjectId}
          canAssess={canAssess}
        />
      </div>

      {/* Slide-over Risk Drawer */}
      {selectedProjectId && selectedProjectRisk?.assessment ? (
        <RiskDetailDrawer
          projectId={selectedProjectId}
          assessment={selectedProjectRisk.assessment}
          resolutions={selectedProjectResolutions?.items ?? []}
          onClose={() => setSelectedProjectId(null)}
          onAssessNow={() => handleAssessProject(selectedProjectId)}
          isAssessing={assessingProjectId === selectedProjectId}
          canAssess={canAssess}
          canResolve={canResolve}
          onResolutionUpdated={() => {
            refetchSelectedResolutions();
            refetchProjects();
            refetchOverview();
          }}
        />
      ) : null}
    </StaffWorkspaceShell>
  );
}
