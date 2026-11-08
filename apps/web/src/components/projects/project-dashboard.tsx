"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

import { HonestyChip } from "@/components/site-plan/site-plan";
import { ROLE_LABELS, initialsOf } from "@/components/auth/workspace-nav";
import { getAuthEpoch, getMemoryAccessToken, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import { fetchProjects } from "@/lib/projects/api";
import { fetchProjectDashboard } from "@/lib/projects/dashboard-api";
import { getDashboardCopy, type DashboardCopy } from "@/lib/projects/dashboard-messages";
import {
  attentionItems,
  dashboardIsEmpty,
  dashboardStatusLabel,
  portfolioLine,
  type DashboardPayload,
} from "@/lib/projects/dashboard-view";
import { classifyEditError } from "@/lib/projects/edit-outcome";
import { fetchRecords, fetchRecordSummary } from "@/lib/roadsync/conflict-records-api";
import { fetchHubSummary } from "@/lib/roadsync/coordination-api";
import {
  AgencyOfficerCommandView,
  ContractorCommandView,
  GovAdminCommandView,
  InspectorCommandView,
  PlatformCommandView,
  ProjectManagerCommandView,
} from "./role-command-views";

type TableFilter = "ALL" | "ATTENTION" | "PENDING" | "ACTIVE";
export type CommandViewMode =
  | "ROLE_DEFAULT"
  | "CIVIC_COMMAND"
  | "SUPER_ADMIN"
  | "GOV_ADMIN"
  | "AGENCY_OFFICER"
  | "PROJECT_MANAGER"
  | "CONTRACTOR"
  | "INSPECTOR";

function formatLkrMinor(amountMinor: number, locale: AuthLocale): string {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(
      locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK",
      {
        style: "currency",
        currency: "LKR",
        maximumFractionDigits: 0,
      },
    ).format(major);
  } catch {
    return `LKR ${major.toLocaleString()}`;
  }
}

function stageProgressForStatus(status: string): {
  currentStage: number;
  stageName: string;
  isCritical: boolean;
  nodeGlyph: "●" | "○" | "◆" | "✓";
} {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED" || normalized === "CLOSED") {
    return {
      currentStage: 8,
      stageName: "Stage 8/8: Certified Handover",
      isCritical: false,
      nodeGlyph: "✓",
    };
  }
  if (normalized === "ON_HOLD" || normalized === "DELAYED" || normalized === "REJECTED") {
    return {
      currentStage: 4,
      stageName: "Stage 4/8: Hold / Conflict Review",
      isCritical: true,
      nodeGlyph: "◆",
    };
  }
  if (normalized === "ACTIVE" || normalized === "IN_PROGRESS") {
    return {
      currentStage: 5,
      stageName: "Stage 5/8: Trenching & Civil Works",
      isCritical: false,
      nodeGlyph: "●",
    };
  }
  if (normalized === "APPROVED") {
    return {
      currentStage: 4,
      stageName: "Stage 4/8: Corridor Mobilization",
      isCritical: false,
      nodeGlyph: "●",
    };
  }
  if (normalized === "UNDER_REVIEW" || normalized === "SUBMITTED") {
    return {
      currentStage: 3,
      stageName: "Stage 3/8: Statutory Clearance",
      isCritical: false,
      nodeGlyph: "○",
    };
  }
  return {
    currentStage: 2,
    stageName: "Stage 2/8: Cadastral Survey & Design",
    isCritical: false,
    nodeGlyph: "○",
  };
}

export function ProjectDashboard({
  locale,
  initialViewMode = "ROLE_DEFAULT",
}: {
  locale: AuthLocale;
  initialViewMode?: CommandViewMode;
}) {
  const copy = getDashboardCopy(locale);
  const epoch = useSyncExternalStore(subscribeAuth, getAuthEpoch, () => 0);
  const hasToken = useSyncExternalStore(
    subscribeAuth,
    () => Boolean(getMemoryAccessToken()),
    () => false,
  );
  const sessionUser = useSyncExternalStore(
    subscribeAuth,
    () => getMemorySession()?.user ?? null,
    () => null,
  );

  const [tableFilter, setTableFilter] = useState<TableFilter>("ALL");
  const [page, setPage] = useState(1);
  const [quarterWindow, setQuarterWindow] = useState<"ALL" | "ACTIVE_ONLY">("ALL");
  const [viewMode, setViewMode] = useState<CommandViewMode>(initialViewMode);

  const query = useQuery({
    queryKey: ["projects", "dashboard", epoch],
    queryFn: fetchProjectDashboard,
    enabled: hasToken,
    retry: false,
  });

  const projectsListQuery = useQuery({
    queryKey: ["projects", "dashboard-table", epoch, page],
    queryFn: () => fetchProjects({ page, limit: 6 }),
    enabled: hasToken,
    staleTime: 30_000,
    retry: false,
  });

  const conflictSummaryQuery = useQuery({
    queryKey: ["roadsync", "conflicts-summary", epoch],
    queryFn: fetchRecordSummary,
    enabled: hasToken,
    staleTime: 30_000,
    retry: false,
  });

  const conflictRecordsQuery = useQuery({
    queryKey: ["roadsync", "conflicts-top", epoch],
    queryFn: () => fetchRecords("page=1&limit=3"),
    enabled: hasToken,
    staleTime: 30_000,
    retry: false,
  });

  const coordSummaryQuery = useQuery({
    queryKey: ["roadsync", "coordination-summary", epoch],
    queryFn: fetchHubSummary,
    enabled: hasToken,
    staleTime: 30_000,
    retry: false,
  });

  if (!hasToken || query.isPending) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-gutter-desktop py-8">
        <div
          className="bg-surface-container-lowest p-8 rounded border border-outline-variant/30 shadow-2xs flex items-center gap-4"
          role="status"
        >
          <span className="w-3 h-3 rounded-full bg-secondary-container animate-ping" />
          <span className="font-title-md text-title-md text-on-surface">{copy.loading}</span>
        </div>
      </div>
    );
  }

  if (query.isError) {
    const failure = classifyEditError(query.error);
    const isForbidden = failure === "denied";
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-gutter-desktop py-8">
        <div
          className="bg-error-container/25 border border-error/30 rounded p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          role="alert"
        >
          <div>
            <div className="font-title-md text-title-md font-bold text-on-error-container">
              {isForbidden ? copy.forbidden : copy.unavailable}
            </div>
          </div>
          {!isForbidden && (
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="px-4 py-2 rounded bg-secondary text-white font-semibold text-xs hover:bg-secondary-container transition-colors"
            >
              {copy.retry}
            </button>
          )}
        </div>
      </div>
    );
  }

  const data = query.data;
  const scopeText =
    data.scope === "agency"
      ? `${copy.scopeAgency}${sessionUser?.agencyId ? ` · ${sessionUser.agencyId}` : ""}`
      : data.scope === "assigned"
        ? copy.scopeAssigned
        : copy.scopePlatform;

  const userRole = sessionUser?.roleKey ?? "CONTRACTOR";
  const effectiveView: Exclude<CommandViewMode, "ROLE_DEFAULT"> =
    viewMode === "ROLE_DEFAULT"
      ? userRole === "SUPER_ADMIN" ||
        userRole === "GOV_ADMIN" ||
        userRole === "AGENCY_OFFICER" ||
        userRole === "PROJECT_MANAGER" ||
        userRole === "CONTRACTOR" ||
        userRole === "INSPECTOR"
        ? userRole
        : "CIVIC_COMMAND"
      : viewMode;

  const canPreviewAllRoles =
    userRole === "SUPER_ADMIN" || userRole === "GOV_ADMIN";

  const handleExportTelemetry = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      asOf: data.asOf,
      scope: data.scope,
      effectiveView,
      counts: data.counts,
      physical: data.physical,
      finance: data.finance,
      milestones: data.milestones,
      reviews: data.reviews,
      conflicts: conflictSummaryQuery.data ?? null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `infraos-telemetry-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (dashboardIsEmpty(data) && effectiveView === "CIVIC_COMMAND") {
    return (
      <div>
        <RoleCommandPerspectiveBar
          userRole={userRole}
          effectiveView={effectiveView}
          canPreviewAllRoles={canPreviewAllRoles}
          onSelectView={setViewMode}
        />
        <DashboardTopBanner
          copy={copy}
          scopeText={scopeText}
          quarterWindow={quarterWindow}
          onToggleWindow={() =>
            setQuarterWindow((w) => (w === "ALL" ? "ACTIVE_ONLY" : "ALL"))
          }
          onExport={handleExportTelemetry}
        />
        <div className="max-w-[1600px] mx-auto px-4 sm:px-gutter-desktop py-8">
          <div className="bg-surface-container-lowest p-10 rounded border border-outline-variant/30 text-center">
            <p className="font-title-lg text-title-lg text-on-surface font-semibold">
              {copy.empty}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link
                href="/projects"
                className="px-4 py-2 rounded bg-secondary text-white font-semibold text-xs hover:bg-secondary-container transition-colors"
              >
                {copy.projects}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <RoleCommandPerspectiveBar
        userRole={userRole}
        effectiveView={effectiveView}
        canPreviewAllRoles={canPreviewAllRoles}
        onSelectView={setViewMode}
      />

      {effectiveView === "SUPER_ADMIN" ? (
        <PlatformCommandView
          data={data}
          copy={copy}
          locale={locale}
          epoch={epoch}
          sessionUser={sessionUser}
          conflictSummary={conflictSummaryQuery.data}
          coordSummary={coordSummaryQuery.data}
          onExportTelemetry={handleExportTelemetry}
        />
      ) : effectiveView === "GOV_ADMIN" ? (
        <GovAdminCommandView
          data={data}
          copy={copy}
          locale={locale}
          epoch={epoch}
          sessionUser={sessionUser}
          conflictSummary={conflictSummaryQuery.data}
          conflictRecords={conflictRecordsQuery.data?.items ?? []}
          coordSummary={coordSummaryQuery.data}
          onExportTelemetry={handleExportTelemetry}
        />
      ) : effectiveView === "AGENCY_OFFICER" ? (
        <AgencyOfficerCommandView
          data={data}
          copy={copy}
          locale={locale}
          epoch={epoch}
          sessionUser={sessionUser}
          conflictSummary={conflictSummaryQuery.data}
          conflictRecords={conflictRecordsQuery.data?.items ?? []}
          coordSummary={coordSummaryQuery.data}
          onExportTelemetry={handleExportTelemetry}
        />
      ) : effectiveView === "PROJECT_MANAGER" ? (
        <ProjectManagerCommandView
          data={data}
          copy={copy}
          locale={locale}
          epoch={epoch}
          sessionUser={sessionUser}
          conflictRecords={conflictRecordsQuery.data?.items ?? []}
          onExportTelemetry={handleExportTelemetry}
        />
      ) : effectiveView === "CONTRACTOR" ? (
        <ContractorCommandView
          data={data}
          copy={copy}
          locale={locale}
          epoch={epoch}
          sessionUser={sessionUser}
          conflictRecords={conflictRecordsQuery.data?.items ?? []}
          onExportTelemetry={handleExportTelemetry}
        />
      ) : effectiveView === "INSPECTOR" ? (
        <InspectorCommandView
          data={data}
          copy={copy}
          locale={locale}
          epoch={epoch}
          sessionUser={sessionUser}
          conflictRecords={conflictRecordsQuery.data?.items ?? []}
          onExportTelemetry={handleExportTelemetry}
        />
      ) : (
        <DashboardView
          data={data}
          copy={copy}
          locale={locale}
          scopeText={scopeText}
          sessionUser={sessionUser}
          projectsList={projectsListQuery.data}
          conflictSummary={conflictSummaryQuery.data}
          conflictRecords={conflictRecordsQuery.data?.items ?? []}
          coordSummary={coordSummaryQuery.data}
          tableFilter={tableFilter}
          onTableFilterChange={setTableFilter}
          page={page}
          onPageChange={setPage}
          quarterWindow={quarterWindow}
          onToggleWindow={() =>
            setQuarterWindow((w) => (w === "ALL" ? "ACTIVE_ONLY" : "ALL"))
          }
        />
      )}
    </div>
  );
}

function RoleCommandPerspectiveBar({
  userRole,
  effectiveView,
  canPreviewAllRoles,
  onSelectView,
}: {
  userRole: string;
  effectiveView: Exclude<CommandViewMode, "ROLE_DEFAULT">;
  canPreviewAllRoles: boolean;
  onSelectView: (mode: CommandViewMode) => void;
}) {
  const roleLabel = ROLE_LABELS[userRole as keyof typeof ROLE_LABELS] ?? userRole;
  const roleDefaultView: Exclude<CommandViewMode, "ROLE_DEFAULT"> =
    userRole === "SUPER_ADMIN" ||
    userRole === "GOV_ADMIN" ||
    userRole === "AGENCY_OFFICER" ||
    userRole === "PROJECT_MANAGER" ||
    userRole === "CONTRACTOR" ||
    userRole === "INSPECTOR"
      ? userRole
      : "CIVIC_COMMAND";

  const perspectiveOptions: Array<{
    id: Exclude<CommandViewMode, "ROLE_DEFAULT">;
    label: string;
    code: string;
    icon: string;
  }> = canPreviewAllRoles
    ? [
        {
          id: "CIVIC_COMMAND",
          label: "Civic Situation Room",
          code: "CORE-02.01",
          icon: "radar",
        },
        {
          id: "SUPER_ADMIN",
          label: "Platform Command",
          code: "CORE-02.09",
          icon: "admin_panel_settings",
        },
        {
          id: "GOV_ADMIN",
          label: "Gov Infrastructure",
          code: "CORE-02.10",
          icon: "account_balance",
        },
        {
          id: "AGENCY_OFFICER",
          label: "Agency Operations",
          code: "CORE-02.11",
          icon: "domain",
        },
        {
          id: "PROJECT_MANAGER",
          label: "My Project Command",
          code: "CORE-02.12",
          icon: "engineering",
        },
        {
          id: "CONTRACTOR",
          label: "Contractor Command",
          code: "CORE-02.13",
          icon: "precision_manufacturing",
        },
        {
          id: "INSPECTOR",
          label: "Field Inspection",
          code: "CORE-02.14",
          icon: "fact_check",
        },
      ]
    : roleDefaultView !== "CIVIC_COMMAND"
      ? [
          {
            id: roleDefaultView,
            label: `${roleLabel} Command`,
            code:
              roleDefaultView === "AGENCY_OFFICER"
                ? "CORE-02.11"
                : roleDefaultView === "PROJECT_MANAGER"
                  ? "CORE-02.12"
                  : roleDefaultView === "CONTRACTOR"
                    ? "CORE-02.13"
                    : "CORE-02.14",
            icon:
              roleDefaultView === "AGENCY_OFFICER"
                ? "domain"
                : roleDefaultView === "PROJECT_MANAGER"
                  ? "engineering"
                  : roleDefaultView === "CONTRACTOR"
                    ? "precision_manufacturing"
                    : "fact_check",
          },
          {
            id: "CIVIC_COMMAND",
            label: "Civic Situation Room",
            code: "CORE-02.01",
            icon: "radar",
          },
        ]
      : [
          {
            id: "CIVIC_COMMAND",
            label: "Civic Situation Room",
            code: "CORE-02.01",
            icon: "radar",
          },
        ];

  return (
    <div className="bg-[#14202d] text-white border-b border-white/10 px-4 sm:px-gutter-desktop py-2.5">
      <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary/20 border border-secondary/40 text-[#ffb59a] text-[10px] font-mono font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
            Role-Aware Command V2
          </span>
          <span className="text-slate-300 text-[11px]">
            Authenticated as <strong className="text-white">{roleLabel}</strong>
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
          role="tablist"
          aria-label="Civic Command Perspective Switcher"
        >
          {perspectiveOptions.map((opt) => {
            const active = effectiveView === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectView(opt.id)}
                className={
                  active
                    ? "inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-secondary text-white text-[11px] font-bold shadow-2xs transition-colors shrink-0"
                    : "inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-semibold border border-white/10 transition-colors shrink-0"
                }
              >
                <span className="material-symbols-outlined text-[14px]">
                  {opt.icon}
                </span>
                <span>{opt.label}</span>
                <span className="text-[9px] font-mono opacity-75">
                  [{opt.code}]
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DashboardTopBanner({
  copy,
  scopeText,
  quarterWindow,
  onToggleWindow,
  onExport,
}: {
  copy: DashboardCopy;
  scopeText: string;
  quarterWindow: "ALL" | "ACTIVE_ONLY";
  onToggleWindow: () => void;
  onExport: () => void;
}) {
  return (
    <div className="bg-surface-container-low/60 border-b border-outline-variant/25 px-4 sm:px-gutter-desktop py-6">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-label-sm font-label-sm uppercase text-secondary mb-2 flex-wrap">
            <span className="material-symbols-outlined text-[14px]">share_location</span>
            <span>National Infrastructure</span>
            <span>/</span>
            <span>{scopeText}</span>
            <span>/</span>
            <span className="px-1.5 py-0.5 bg-secondary-fixed text-on-secondary-fixed rounded-xs font-mono">
              [ CERTIFIED CADASTRAL ]
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
            {copy.title}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1 max-w-2xl">
            {copy.description}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={onToggleWindow}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs font-semibold hover:bg-surface-container-low transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
              calendar_today
            </span>
            <span>
              {quarterWindow === "ALL" ? "All Active Windows" : "Execution Window Only"}
            </span>
            <span className="material-symbols-outlined text-[14px] text-outline">
              expand_more
            </span>
          </button>

          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs font-semibold hover:bg-surface-container-low transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
              download
            </span>
            <span>Export Telemetry</span>
          </button>

          <Link
            href="/roadsync/work-requests/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gradient-to-b from-secondary to-[#802a00] text-white text-xs font-semibold shadow-sm hover:brightness-110 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            <span>Initiate Work Request</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function DashboardView({
  data,
  copy,
  locale,
  scopeText,
  sessionUser,
  projectsList,
  conflictSummary,
  conflictRecords,
  coordSummary,
  tableFilter,
  onTableFilterChange,
  page,
  onPageChange,
  quarterWindow,
  onToggleWindow,
}: {
  data: DashboardPayload;
  copy: DashboardCopy;
  locale: AuthLocale;
  scopeText: string;
  sessionUser: ReturnType<typeof getMemorySession> extends infer S
    ? S extends { user: infer U }
      ? U | null
      : null
    : null;
  projectsList: Awaited<ReturnType<typeof fetchProjects>> | undefined;
  conflictSummary: Awaited<ReturnType<typeof fetchRecordSummary>> | undefined;
  conflictRecords: Awaited<ReturnType<typeof fetchRecords>>["items"];
  coordSummary: Awaited<ReturnType<typeof fetchHubSummary>> | undefined;
  tableFilter: TableFilter;
  onTableFilterChange: (f: TableFilter) => void;
  page: number;
  onPageChange: (p: number) => void;
  quarterWindow: "ALL" | "ACTIVE_ONLY";
  onToggleWindow: () => void;
}) {
  const [tableSearch, setTableSearch] = useState("");
  const [radarLayers, setRadarLayers] = useState({
    corridors: true,
    clashes: true,
    utilities: true,
  });

  const line = portfolioLine(data);
  const fin = data.finance;
  const phys = data.physical;
  const attentionList = attentionItems(data);

  const detectedConflicts = conflictSummary?.needsMyAck ?? data.counts.delayed;
  const criticalConflicts = conflictSummary?.criticalHigh ?? data.counts.delayed;

  const pendingApprovalsCount =
    (data.reviews?.pending ?? 0) + (coordSummary?.needsMyResponse ?? 0);
  const overdueApprovalsCount =
    (data.milestones?.overdue ?? 0) + (coordSummary?.escalated ?? 0);

  const projectRows = useMemo(() => {
    const items = projectsList?.projects ?? [];
    const combined =
      items.length > 0
        ? items.map((p) => ({
            id: p.id,
            code: p.projectCode,
            title: p.title,
            agency: p.agencyCode ?? p.agencyId,
            projectType: p.projectType.replace(/_/g, " "),
            status: p.status,
          }))
        : data.recentProjects.map((r) => ({
            id: r.id,
            code: r.projectCode,
            title: r.title,
            agency: scopeText,
            projectType: "Capital Corridor",
            status: r.status,
          }));

    return combined.filter((row) => {
      if (quarterWindow === "ACTIVE_ONLY" && row.status === "COMPLETED") {
        return false;
      }
      if (tableFilter === "ATTENTION") {
        if (
          row.status !== "ON_HOLD" &&
          row.status !== "DELAYED" &&
          row.status !== "REJECTED"
        ) {
          return false;
        }
      } else if (tableFilter === "PENDING") {
        if (
          row.status !== "UNDER_REVIEW" &&
          row.status !== "SUBMITTED" &&
          row.status !== "DRAFT"
        ) {
          return false;
        }
      } else if (tableFilter === "ACTIVE") {
        if (row.status !== "ACTIVE" && row.status !== "APPROVED") {
          return false;
        }
      }
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        return (
          row.code.toLowerCase().includes(q) ||
          row.title.toLowerCase().includes(q) ||
          row.agency.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projectsList, data.recentProjects, scopeText, tableFilter, quarterWindow, tableSearch]);

  const handleExportTelemetry = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      asOf: data.asOf,
      scope: data.scope,
      counts: data.counts,
      physical: data.physical,
      finance: data.finance,
      milestones: data.milestones,
      reviews: data.reviews,
      conflicts: conflictSummary ?? null,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `infraos-telemetry-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayName = sessionUser
    ? sessionUser.displayName || `${sessionUser.firstName} ${sessionUser.lastName}`.trim() || sessionUser.email
    : "Authenticated Operator";
  const roleLabel = sessionUser?.roleKey
    ? ROLE_LABELS[sessionUser.roleKey] ?? sessionUser.roleKey
    : "Operations Staff";

  return (
    <div>
      {/* TOP COMMAND TELEMETRY SCRIM & PAGE HEADER */}
      <DashboardTopBanner
        copy={copy}
        scopeText={scopeText}
        quarterWindow={quarterWindow}
        onToggleWindow={onToggleWindow}
        onExport={handleExportTelemetry}
      />

      {/* MAIN OPERATIONS CANVAS */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-gutter-desktop py-6 space-y-6 pb-12">
        {/* CORE-02.01: 6-TILE EXECUTIVE METRICS STRIP */}
        <section
          aria-label="CORE-02.01 Executive Metrics Strip"
          className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3"
        >
          <div className="bg-surface-container-lowest p-4 rounded border border-outline-variant/30 shadow-2xs relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-primary" />
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              <span>{copy.total}</span>
              <span className="text-primary font-mono">●</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline text-2xl font-bold text-on-surface tabular-nums">
                {data.counts.total}
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded tabular-nums">
                {phys.completedByStatus} {copy.completedByStatus}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-on-surface-variant truncate">
              {scopeText}
            </p>
          </div>

          <div className="bg-surface-container-lowest p-4 rounded border border-outline-variant/30 shadow-2xs relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-secondary" />
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              <span>{copy.active}</span>
              <span className="text-secondary font-mono">●</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline text-2xl font-bold text-on-surface tabular-nums">
                {data.counts.active}
              </span>
              <span className="text-[11px] font-mono font-semibold text-secondary">
                {data.counts.total > 0
                  ? `${Math.round((data.counts.active / data.counts.total) * 100)}%`
                  : "0%"}{" "}
                Active
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-on-surface-variant truncate">
              Corridor trenching &amp; paving
            </p>
          </div>

          <div className="bg-surface-container-lowest p-4 rounded border border-error/30 shadow-2xs relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-error" />
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-error">
              <span>Delivery Risks</span>
              <span className="font-mono">◆</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline text-2xl font-bold text-error tabular-nums">
                {data.counts.delayed + detectedConflicts}
              </span>
              <span className="text-[11px] font-bold text-error bg-error-container/60 px-1.5 py-0.5 rounded tabular-nums">
                {criticalConflicts} Clashes
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-on-surface-variant truncate">
              {data.counts.delayed} {copy.delayed} · {detectedConflicts} Overlaps
            </p>
          </div>

          <div className="bg-surface-container-lowest p-4 rounded border border-outline-variant/30 shadow-2xs relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-600" />
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              <span>{copy.reviews}</span>
              <span className="text-amber-600 font-mono">○</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline text-2xl font-bold text-on-surface tabular-nums">
                {pendingApprovalsCount}
              </span>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded tabular-nums">
                {overdueApprovalsCount} Overdue
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-on-surface-variant truncate">
              Statutory &amp; agency sign-offs
            </p>
          </div>

          <div className="bg-surface-container-lowest p-4 rounded border border-outline-variant/30 shadow-2xs relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-slate-500" />
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              <span>{copy.onHold}</span>
              <span className="text-slate-600 font-mono">⊗</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline text-2xl font-bold text-on-surface tabular-nums">
                {data.counts.onHold}
              </span>
              <span className="text-[11px] font-mono text-on-surface-variant">
                Hold / Moratorium
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-on-surface-variant truncate">
              Awaiting utility clearance
            </p>
          </div>

          <div className="bg-surface-container-lowest p-4 rounded border border-dashed border-outline-variant/60 shadow-2xs relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-700" />
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              <span>Provisional Exp.</span>
              <span className="px-1 py-0.2 bg-amber-50 text-amber-900 border border-dashed border-amber-400 rounded-xs text-[9px] font-mono">
                [ {copy.provisional} ]
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline text-xl font-bold text-on-surface font-mono tabular-nums truncate">
                {fin ? formatLkrMinor(fin.storedPaidAmountMinor, locale) : "—"}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-on-surface-variant truncate">
              {fin ? `${fin.storedPaidCount} certified vouchers` : copy.financeMeaning}
            </p>
          </div>
        </section>

        {/* SECTION 1: THE INFRASTRUCTURE THREAD — SIGNATURE METRIC RIBBON */}
        <section
          aria-label="Key Operational Telemetry"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 relative"
        >
          {/* Decorative Route Connector Line behind cards on desktop */}
          <div className="hidden xl:block absolute top-1/2 left-8 right-8 h-[2px] bg-outline-variant/40 -z-10" />

          {/* KPI Card 1: Active Capital Corridors */}
          <div className="bg-surface-container-lowest p-5 rounded border border-outline-variant/30 shadow-2xs relative overflow-hidden group hover:border-secondary/40 transition-colors">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-primary-container" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-label-sm font-label-sm uppercase text-on-surface-variant flex items-center gap-1.5">
                  <span className="text-secondary">●</span> {copy.active} / {copy.total}
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg text-on-surface tabular-nums">
                    {data.counts.active}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 tabular-nums">
                    {data.counts.total} Total
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">conversion_path</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
              <span>{copy.finance}:</span>
              <span className="font-mono font-semibold text-on-surface tabular-nums">
                {fin ? formatLkrMinor(fin.storedPaidAmountMinor, locale) : "—"}
              </span>
            </div>
          </div>

          {/* KPI Card 2: Spatial Conflicts (RoadSync Alert) */}
          <div className="bg-surface-container-lowest p-5 rounded border border-error/30 shadow-2xs relative overflow-hidden group hover:border-error transition-colors">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-error" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-label-sm font-label-sm uppercase text-error flex items-center gap-1.5">
                  <span>◆</span> RoadSync Conflicts
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg text-error tabular-nums">
                    {detectedConflicts}
                  </span>
                  <span className="text-xs font-bold text-on-error-container bg-error-container px-1.5 py-0.5 rounded tabular-nums">
                    {criticalConflicts} Critical
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded bg-error-container/50 flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[20px]">warning</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">
                {copy.onHold}: <strong className="tabular-nums">{data.counts.onHold}</strong> ·{" "}
                {copy.delayed}: <strong className="tabular-nums">{data.counts.delayed}</strong>
              </span>
              <Link
                href="/roadsync/conflicts"
                className="font-semibold text-error hover:underline flex items-center gap-0.5"
              >
                <span>Mediate</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          </div>

          {/* KPI Card 3: Inter-Agency Clearances */}
          <div className="bg-surface-container-lowest p-5 rounded border border-outline-variant/30 shadow-2xs relative overflow-hidden hover:border-secondary/40 transition-colors">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-secondary-container" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-label-sm font-label-sm uppercase text-on-surface-variant flex items-center gap-1.5">
                  <span className="text-secondary-container">○</span> {copy.reviews}
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg text-on-surface tabular-nums">
                    {pendingApprovalsCount}
                  </span>
                  <span className="text-xs font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300/80 tabular-nums">
                    {overdueApprovalsCount} SLA Risk
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded bg-surface-container-low flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[20px]">verified_user</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
              <span>{copy.reviewQueue}</span>
              <Link
                href="/projects/reviews"
                className="font-mono font-semibold text-secondary hover:underline flex items-center gap-0.5"
              >
                <span>Open Queue</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          </div>

          {/* KPI Card 4: Field Inspection & Audit Rate */}
          <div className="bg-surface-container-lowest p-5 rounded border border-outline-variant/30 shadow-2xs relative overflow-hidden hover:border-secondary/40 transition-colors">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-700" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-label-sm font-label-sm uppercase text-on-surface-variant flex items-center gap-1.5">
                  <span className="text-emerald-700">✓</span> {copy.completedByStatus}
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg text-on-surface tabular-nums">
                    {phys.completedByStatus}
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-dashed border-outline-variant text-on-surface-variant rounded-xs">
                    [ {copy.provisional} ]
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded bg-surface-container-low flex items-center justify-center text-emerald-700">
                <span className="material-symbols-outlined text-[20px]">fact_check</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
              <span>
                {copy.reportedOpen}:{" "}
                <strong className="text-on-surface tabular-nums">
                  {phys.reportedAt100StillNotCompleted}
                </strong>
              </span>
              <span className="font-mono font-semibold text-emerald-800 tabular-nums">
                {data.assignedToYou ?? 0} {copy.assigned}
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 2: 12-COLUMN DUAL-SURFACE OPERATIONS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 8 COLUMNS: Primary Operations & Lifecycle Ledger */}
          <div className="lg:col-span-8 space-y-6">
            {/* Active Corridor Operations Table Card */}
            <div className="bg-surface-container-lowest rounded border border-outline-variant/30 shadow-2xs overflow-hidden">
              <div className="p-5 border-b border-outline-variant/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-title-lg text-title-lg text-on-surface">
                      Active Infrastructure Projects
                    </h2>
                    <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-surface-container-low text-on-surface-variant rounded tabular-nums">
                      {projectsList?.total ?? data.counts.total} Total
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    8-Stage lifecycle tracking across municipal road, water, power, and telecom corridors
                  </p>
                </div>

                {/* Table Search + View Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2.5 top-1.5 text-[15px] text-outline">
                      search
                    </span>
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Filter corridors..."
                      aria-label="Filter corridors by code, title, or agency"
                      className="h-7 pl-7 pr-2.5 text-xs bg-surface-container-low rounded border border-outline-variant/40 text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-secondary w-36 sm:w-44"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded border border-outline-variant/30">
                    {(
                      [
                        { id: "ALL", label: "All Projects" },
                        {
                          id: "ATTENTION",
                          label: `Delayed / Hold (${data.counts.delayed + data.counts.onHold})`,
                          isCritical: data.counts.delayed + data.counts.onHold > 0,
                        },
                        { id: "PENDING", label: "Pending Approval" },
                        { id: "ACTIVE", label: "Active" },
                      ] as const
                    ).map((pill) => {
                      const active = tableFilter === pill.id;
                      return (
                        <button
                          key={pill.id}
                          type="button"
                          onClick={() => onTableFilterChange(pill.id)}
                          className={
                            active
                              ? "px-2.5 py-1 rounded-xs text-xs font-semibold bg-surface-container-lowest text-on-surface shadow-2xs"
                              : "isCritical" in pill && pill.isCritical
                                ? "px-2.5 py-1 rounded-xs text-xs font-medium text-error hover:bg-surface-container-lowest/60 transition-colors"
                                : "px-2.5 py-1 rounded-xs text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors"
                          }
                        >
                          {pill.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* High-Density Operations Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/70 border-b border-outline-variant/30 text-label-sm font-label-sm uppercase text-on-surface-variant">
                      <th className="py-3 pl-5 pr-3">Corridor &amp; Project ID</th>
                      <th className="py-3 px-3">Lead Agency</th>
                      <th className="py-3 px-3">Lifecycle Stage (1–8)</th>
                      <th className="py-3 px-3 text-right">Financials (LKR)</th>
                      <th className="py-3 px-3">Status &amp; Risk</th>
                      <th className="py-3 pl-3 pr-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 text-body-md">
                    {projectRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 px-5 text-center text-on-surface-variant text-xs"
                        >
                          {copy.attentionClear}
                        </td>
                      </tr>
                    ) : (
                      projectRows.map((row) => {
                        const stageInfo = stageProgressForStatus(row.status);
                        const hasCriticalReason = stageInfo.isCritical;

                        return (
                          <tr
                            key={row.id}
                            className="hover:bg-surface-container-low/50 transition-colors group"
                          >
                            <td className="py-3.5 pl-5 pr-3">
                              <div className="flex items-start gap-2.5">
                                <span
                                  className={`mt-1 text-xs font-bold ${
                                    hasCriticalReason
                                      ? "text-error"
                                      : stageInfo.nodeGlyph === "✓"
                                        ? "text-emerald-700"
                                        : "text-secondary"
                                  }`}
                                  title={row.status}
                                >
                                  {stageInfo.nodeGlyph}
                                </span>
                                <div>
                                  <Link
                                    href={`/projects/${row.id}`}
                                    className="font-semibold text-on-surface group-hover:text-secondary transition-colors cursor-pointer"
                                  >
                                    {row.title}
                                  </Link>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-on-surface-variant font-mono tabular-nums">
                                    <span>{row.code}</span>
                                    <span>•</span>
                                    <span>{row.projectType}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container text-on-surface text-xs font-semibold">
                                {row.agency}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="w-36">
                                <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                                  <span
                                    className={
                                      hasCriticalReason
                                        ? "text-error truncate"
                                        : "text-on-surface truncate"
                                    }
                                  >
                                    {stageInfo.stageName}
                                  </span>
                                </div>
                                <div className="grid grid-cols-8 gap-0.5 h-1.5">
                                  {Array.from({ length: 8 }).map((_, idx) => {
                                    const stepNum = idx + 1;
                                    const className =
                                      stepNum < stageInfo.currentStage
                                        ? "bg-primary-container rounded-xs"
                                        : stepNum === stageInfo.currentStage
                                          ? hasCriticalReason
                                            ? "bg-error rounded-xs animate-pulse"
                                            : "bg-secondary-container rounded-xs"
                                          : "bg-outline-variant/40 rounded-xs";
                                    return <div key={stepNum} className={className} />;
                                  })}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                              <div className="text-xs font-semibold text-on-surface">
                                {fin
                                  ? formatLkrMinor(fin.storedPaidAmountMinor, locale)
                                  : "—"}
                              </div>
                              <div className="text-[10px] text-on-surface-variant">
                                {fin ? `${fin.storedPaidCount} Paid Rows` : copy.provisional}
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              {hasCriticalReason ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-error-container text-on-error-container text-xs font-bold">
                                  <span className="text-[10px]">◆</span>{" "}
                                  {dashboardStatusLabel(row.status, copy)}
                                </span>
                              ) : row.status === "COMPLETED" ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-semibold">
                                  <span className="text-[10px]">✓</span> Completed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-secondary-fixed text-on-secondary-fixed text-xs font-semibold">
                                  <span className="text-[10px]">●</span>{" "}
                                  {dashboardStatusLabel(row.status, copy)}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 pl-3 pr-5 text-right">
                              <Link
                                href={`/projects/${row.id}`}
                                className="px-2.5 py-1 rounded border border-outline-variant/60 text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors inline-block"
                              >
                                Inspect
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Pagination */}
              <div className="px-5 py-3 bg-surface-container-low/40 border-t border-outline-variant/25 flex items-center justify-between text-xs text-on-surface-variant">
                <span>
                  Showing <strong className="text-on-surface tabular-nums">{projectRows.length}</strong>{" "}
                  corridor records (Page <strong className="tabular-nums">{page}</strong>)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    className="px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-semibold disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={
                      !projectsList || page * projectsList.limit >= projectsList.total
                    }
                    onClick={() => onPageChange(page + 1)}
                    className="px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant/50 text-on-surface font-semibold hover:bg-surface-container transition-colors disabled:opacity-50"
                  >
                    Next
                  </button>
                  <Link
                    href="/projects"
                    className="ml-2 px-2.5 py-1 rounded bg-primary-container text-white font-semibold hover:bg-primary transition-colors"
                  >
                    {copy.viewList}
                  </Link>
                </div>
              </div>
            </div>

            {/* Secondary Operations Row: Portfolio Lifecycle & Statutory Clearances */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card A: Portfolio Lifecycle & Status Distribution */}
              <div className="bg-surface-container-lowest p-5 rounded border border-outline-variant/30 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-label-sm font-label-sm uppercase text-on-surface-variant">
                    {copy.statusTable}
                  </span>
                  <HonestyChip kind="provisional" label={copy.provisional} />
                </div>
                <h3 className="font-title-md text-title-md text-on-surface">
                  {copy.physicalMeaning}
                </h3>

                {/* 6-Stage Main Lifecycle Rail */}
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {line.main.map((node) => (
                    <Link
                      key={node.status}
                      href={node.href}
                      className="p-2 rounded bg-surface-container-low/60 hover:bg-surface-container border border-outline-variant/30 text-center transition-colors"
                    >
                      <div className="font-headline-md text-base font-bold text-on-surface tabular-nums">
                        {node.count}
                      </div>
                      <div className="text-[10px] font-semibold uppercase text-on-surface-variant truncate mt-0.5">
                        {dashboardStatusLabel(node.status, copy)}
                      </div>
                    </Link>
                  ))}
                </div>

                {line.branches.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-wrap items-center gap-2">
                    {line.branches.map((b) => (
                      <Link
                        key={b.status}
                        href={b.href}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-error-container/40 text-on-error-container text-xs font-semibold"
                      >
                        <span>◆</span>
                        <span>{dashboardStatusLabel(b.status, copy)}:</span>
                        <strong className="tabular-nums">{b.count}</strong>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Card B: Statutory Clearances & Attention Ledger */}
              <div className="bg-surface-container-lowest p-5 rounded border border-outline-variant/30 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-label-sm font-label-sm uppercase text-on-surface-variant">
                      {copy.attention}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-secondary-fixed text-on-secondary-fixed rounded-xs tabular-nums">
                      [ {attentionList.length} FLAGGED ]
                    </span>
                  </div>
                  <h3 className="font-title-md text-title-md text-on-surface">
                    {copy.plannedMeaning}
                  </h3>

                  <div className="mt-3 space-y-2">
                    {attentionList.length === 0 ? (
                      <p className="text-xs text-on-surface-variant py-3">
                        {copy.attentionClear}
                      </p>
                    ) : (
                      attentionList.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2.5 rounded bg-surface-container-low/60 border border-outline-variant/25 text-xs gap-2"
                        >
                          <div className="font-semibold text-on-surface">
                            {copy[item.id]}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-mono font-bold tabular-nums">
                              {item.count}
                            </span>
                            {item.href && (
                              <Link
                                href={item.href}
                                className="text-secondary font-semibold hover:underline"
                              >
                                Inspect →
                              </Link>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">
                    {copy.overdue}:{" "}
                    <strong className="text-error tabular-nums">
                      {data.milestones?.overdue ?? 0}
                    </strong>{" "}
                    · {copy.due}:{" "}
                    <strong className="text-on-surface tabular-nums">
                      {data.milestones?.dueWithin14Days ?? 0}
                    </strong>
                  </span>
                  <Link
                    href="/projects/reviews"
                    className="font-semibold text-secondary hover:underline flex items-center gap-1"
                  >
                    <span>{copy.reviewQueue}</span>
                    <span className="material-symbols-outlined text-[14px]">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT 4 COLUMNS: RoadSync Spatial Intelligence & Conflict Telemetry */}
          <div className="lg:col-span-4 space-y-6">
            {/* Widget 1: RoadSync Spatial Conflict Radar (Interactive GIS Preview) */}
            <div className="bg-primary-container text-white rounded border border-white/10 shadow-ambient overflow-hidden">
              <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary-container animate-ping" />
                  <h2 className="font-title-md text-title-md text-white tracking-tight">
                    RoadSync Conflict Radar
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { key: "corridors", label: "Corridors" },
                      { key: "utilities", label: "Utilities" },
                      { key: "clashes", label: "Clashes" },
                    ] as const
                  ).map((l) => (
                    <button
                      key={l.key}
                      type="button"
                      aria-pressed={radarLayers[l.key]}
                      onClick={() =>
                        setRadarLayers((prev) => ({
                          ...prev,
                          [l.key]: !prev[l.key],
                        }))
                      }
                      className={
                        radarLayers[l.key]
                          ? "px-2 py-0.5 rounded-xs bg-secondary text-white text-[10px] font-mono font-bold transition-colors"
                          : "px-2 py-0.5 rounded-xs bg-white/10 text-slate-300 text-[10px] font-mono hover:bg-white/20 transition-colors"
                      }
                    >
                      {l.label}
                    </button>
                  ))}
                  <Link
                    href="/inframap"
                    className="ml-1 text-xs font-semibold text-primary-fixed hover:text-white flex items-center gap-1"
                  >
                    <span>GIS</span>
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </Link>
                </div>
              </div>

              {/* Stylized Vector GIS Map Canvas */}
              <div className="relative h-52 bg-[#0d1620] cad-grid-bg overflow-hidden p-4 flex flex-col justify-between">
                <svg
                  className="absolute inset-0 w-full h-full opacity-85"
                  viewBox="0 0 400 220"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  {radarLayers.corridors && (
                    <>
                      <path
                        d="M-20 180 C 80 160, 140 90, 240 85 C 310 80, 360 40, 420 20"
                        stroke="#3b4856"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                      <path
                        d="M-20 180 C 80 160, 140 90, 240 85 C 310 80, 360 40, 420 20"
                        stroke="#fd5a00"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                      />
                      <circle
                        cx="290"
                        cy="68"
                        r="5"
                        fill="#fd5a00"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx="85"
                        cy="148"
                        r="5"
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </>
                  )}
                  {radarLayers.utilities && (
                    <path
                      d="M110 -10 L 185 115 L 260 230"
                      stroke="#60a5fa"
                      strokeWidth="2.5"
                    />
                  )}
                  {radarLayers.clashes && (
                    <>
                      <circle
                        cx="175"
                        cy="103"
                        r="18"
                        fill="#ba1a1a"
                        fillOpacity="0.28"
                      />
                      <circle
                        cx="175"
                        cy="103"
                        r="6"
                        fill="#ffdad6"
                        stroke="#ba1a1a"
                        strokeWidth="2.5"
                      />
                    </>
                  )}
                </svg>

                <div className="relative z-10 flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs border border-white/15 text-[10px] font-mono text-primary-fixed">
                    LAT 6.9271° N, LON 79.8612° E
                  </span>
                  <span className="px-2 py-0.5 rounded bg-error text-white text-[10px] font-bold tracking-wider uppercase shadow-sm tabular-nums">
                    ◆ {detectedConflicts} Active Overlaps
                  </span>
                </div>

                <div className="relative z-10 bg-primary/90 backdrop-blur-md p-3 rounded border border-white/15">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-secondary-fixed-dim font-bold">
                        {conflictRecords[0]?.conflictNo ?? "CONFLICT-RADAR"} •{" "}
                        {conflictRecords[0]?.severity.band.toUpperCase() ?? "ACTIVE"}
                      </span>
                      <p className="text-xs font-semibold text-white mt-0.5">
                        {conflictRecords[0]
                          ? `${conflictRecords[0].parties.a.title} × ${conflictRecords[0].parties.b.title}`
                          : "Multi-Agency Utility & Road Corridor"}
                      </p>
                      <p className="text-[11px] text-on-primary-container mt-0.5">
                        {conflictRecords[0]?.severity.primaryClass ??
                          "Spatial & Temporal Corridor Overlap Monitoring"}
                      </p>
                    </div>
                    <Link
                      href={
                        conflictRecords[0]
                          ? `/roadsync/conflicts/${conflictRecords[0].id}`
                          : "/roadsync/conflicts"
                      }
                      className="px-2.5 py-1 rounded bg-secondary-container text-white text-[11px] font-semibold shrink-0 hover:bg-secondary transition-colors"
                    >
                      Mediate
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Widget 2: Live Coordination & Escalation Queue */}
            <div className="bg-surface-container-lowest rounded border border-outline-variant/30 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-outline-variant/25 flex items-center justify-between">
                <div>
                  <h2 className="font-title-md text-title-md text-on-surface">
                    Coordination Queue
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Requires agency officer sign-off
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold tabular-nums">
                  {pendingApprovalsCount || conflictRecords.length}
                </span>
              </div>

              <div className="divide-y divide-outline-variant/20">
                {conflictRecords.length > 0 ? (
                  conflictRecords.slice(0, 3).map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 hover:bg-surface-container-low/50 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-bold text-error flex items-center gap-1">
                          <span>◆</span> {rec.conflictNo} (
                          {rec.severity.band.toUpperCase()})
                        </span>
                        <span className="text-outline font-mono">{rec.status}</span>
                      </div>
                      <p className="text-xs font-semibold text-on-surface">
                        {rec.parties.a.title}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1">
                        Overlaps with: {rec.parties.b.title}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <Link
                          href={`/roadsync/conflicts/${rec.id}`}
                          className="px-2.5 py-1 rounded bg-primary-container text-white text-[11px] font-semibold hover:bg-primary transition-colors"
                        >
                          Open Dossier
                        </Link>
                        <Link
                          href="/roadsync/coordination"
                          className="px-2.5 py-1 rounded border border-outline-variant/60 text-on-surface text-[11px] font-semibold hover:bg-surface-container transition-colors"
                        >
                          Coordination Hub
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-xs text-on-surface-variant">
                    <p className="font-semibold text-on-surface">
                      {copy.reviews}: {data.reviews?.pending ?? 0} ·{" "}
                      {copy.overdue}: {data.milestones?.overdue ?? 0}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Link
                        href="/roadsync/coordination"
                        className="px-2.5 py-1 rounded bg-primary-container text-white text-[11px] font-semibold hover:bg-primary transition-colors"
                      >
                        Open Coordination Hub
                      </Link>
                      <Link
                        href="/projects/reviews"
                        className="px-2.5 py-1 rounded border border-outline-variant/60 text-on-surface text-[11px] font-semibold hover:bg-surface-container transition-colors"
                      >
                        {copy.reviewQueue}
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Widget 2B: Agency Accord Matrix (CORE-02.01) */}
            <div className="bg-surface-container-lowest rounded border border-outline-variant/30 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-outline-variant/25 flex items-center justify-between">
                <div>
                  <h2 className="font-title-md text-title-md text-on-surface">
                    Agency Accord Matrix
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Inter-utility corridor clearance SLA &amp; response ledger
                  </p>
                </div>
                <Link
                  href="/roadsync/coordination"
                  className="text-xs font-semibold text-secondary hover:underline"
                >
                  Open Hub →
                </Link>
              </div>
              <div className="divide-y divide-outline-variant/20 text-xs">
                {[
                  {
                    code: "RDA",
                    name: "Road Development Authority",
                    status: conflictRecords.length > 0 ? "◆ Clash Review" : "✓ Synchronized",
                    tone: conflictRecords.length > 0 ? "text-error" : "text-emerald-700",
                    sla: "96.4% SLA",
                  },
                  {
                    code: "NWSDB",
                    name: "National Water Supply & Drainage",
                    status:
                      (coordSummary?.needsMyResponse ?? 0) > 0
                        ? `○ ${coordSummary?.needsMyResponse} Awaiting`
                        : "✓ Clear",
                    tone:
                      (coordSummary?.needsMyResponse ?? 0) > 0
                        ? "text-amber-700"
                        : "text-emerald-700",
                    sla: "91.8% SLA",
                  },
                  {
                    code: "CEB",
                    name: "Ceylon Electricity Board",
                    status: "● Active Trenching",
                    tone: "text-secondary",
                    sla: "94.2% SLA",
                  },
                  {
                    code: "SLT",
                    name: "Sri Lanka Telecom Ducting",
                    status: "✓ Certified",
                    tone: "text-emerald-700",
                    sla: "98.1% SLA",
                  },
                ].map((ag) => (
                  <div
                    key={ag.code}
                    className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-surface-container-low/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-container-high font-mono text-[10px] font-bold text-on-surface">
                          {ag.code}
                        </span>
                        <span className="font-semibold text-on-surface truncate">
                          {ag.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-bold text-[11px] ${ag.tone}`}>
                        {ag.status}
                      </span>
                      <span className="text-[10px] font-mono text-outline">
                        {ag.sla}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Widget 3: Field Inspector & Operator Readiness */}
            <div className="bg-surface-container-low p-4 rounded border border-outline-variant/30 flex items-center gap-4">
              <div className="w-14 h-14 rounded bg-primary-container text-white flex items-center justify-center font-bold text-base shrink-0 border border-outline-variant/40">
                {initialsOf(displayName)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Field Audit &amp; Telemetry Readiness
                  </span>
                </div>
                <p className="text-xs font-semibold text-on-surface mt-0.5 truncate">
                  {displayName} • {roleLabel}
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">
                  {scopeText} • {data.counts.active} Active Corridors
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle Legal & System Integrity Footer */}
        <footer className="pt-6 border-t border-outline-variant/25 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="font-bold text-on-surface">INFRAOS</span>
            <span>—</span>
            <span>National Infrastructure Intelligence &amp; Coordination Platform</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>[ DEMO ENVIRONMENT ]</span>
            <span>•</span>
            <span>{copy.financeMeaning}</span>
            <span>•</span>
            <span>Civic Atlas API v2.4.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
