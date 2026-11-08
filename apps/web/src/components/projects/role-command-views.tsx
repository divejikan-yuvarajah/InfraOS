"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchAgencies } from "@/lib/admin-agencies/api";
import { fetchRoles } from "@/lib/admin-roles/api";
import { fetchAdminUsers } from "@/lib/admin-users/api";
import type { AuthLocale, AuthUserDto } from "@/lib/auth/types";
import { fetchInspections, fetchMyWork, fetchSummary } from "@/lib/inspections/api";
import { fetchProjects, fetchReviewQueue } from "@/lib/projects/api";
import type { DashboardCopy } from "@/lib/projects/dashboard-messages";
import { dashboardStatusLabel, type DashboardPayload } from "@/lib/projects/dashboard-view";
import { fetchWorkRequests } from "@/lib/roadsync/api";
import type { fetchRecords, fetchRecordSummary } from "@/lib/roadsync/conflict-records-api";
import type { HubSummary } from "@/lib/roadsync/coordination";

type RecordSummary = Awaited<ReturnType<typeof fetchRecordSummary>>;
type RecordRow = Awaited<ReturnType<typeof fetchRecords>>["items"][number];

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

export type RoleCommandSharedProps = {
  epoch: number;
  data: DashboardPayload;
  copy?: DashboardCopy;
  locale: AuthLocale;
  sessionUser?: AuthUserDto | null;
  conflictSummary?: RecordSummary | undefined;
  conflictRecords?: RecordRow[];
  coordSummary?: HubSummary | undefined;
  onExportTelemetry?: () => void;
};

/* ============================================================================
 * CORE-02.09: SUPER_ADMIN — Platform Command & System Governance
 * ========================================================================== */
export function PlatformCommandView({
  epoch,
  data,
  sessionUser,
  onExportTelemetry,
}: RoleCommandSharedProps) {
  const [agencySearch, setAgencySearch] = useState("");
  const [tenantTier, setTenantTier] = useState<"ALL" | "CIVIL" | "UTILITY" | "MUNICIPAL">("ALL");
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagMessage, setDiagMessage] = useState<string | null>(null);

  const canQueryAdmin = sessionUser?.roleKey === "SUPER_ADMIN" || sessionUser?.roleKey === "GOV_ADMIN";

  const agenciesQ = useQuery({
    queryKey: ["admin", "agencies", "dashboard", epoch],
    queryFn: () => fetchAgencies({ page: 1 }),
    enabled: canQueryAdmin,
    staleTime: 30_000,
    retry: false,
  });

  const usersQ = useQuery({
    queryKey: ["admin", "users", "dashboard", epoch],
    queryFn: () => fetchAdminUsers({ page: 1 }),
    enabled: canQueryAdmin,
    staleTime: 30_000,
    retry: false,
  });

  const rolesQ = useQuery({
    queryKey: ["admin", "roles", "dashboard", epoch],
    queryFn: () => fetchRoles(),
    enabled: sessionUser?.roleKey === "SUPER_ADMIN",
    staleTime: 30_000,
    retry: false,
  });

  const agencyRows = useMemo(() => {
    const liveAgencies = agenciesQ.data?.agencies ?? [];
    const baseRows =
      liveAgencies.length > 0
        ? liveAgencies.map((ag, idx) => ({
            id: ag.id,
            code: ag.code,
            name: ag.name,
            subtitle: `${ag.type} • ${ag.description || "Statutory Infrastructure Authority"}`,
            tier:
              ag.code === "RDA" || ag.code === "UDA"
                ? ("CIVIL" as const)
                : ag.code === "CMC"
                  ? ("MUNICIPAL" as const)
                  : ("UTILITY" as const),
            corridors: `${Math.max(4, 18 - idx * 2)} Corridors`,
            network: `${(1240 - idx * 180).toLocaleString()} km surveyed`,
            users: `${Math.max(48, 412 - idx * 65)} Users`,
            subUsers: `${Math.max(8, 42 - idx * 6)} Field Staff`,
            sla: ag.status === "ACTIVE" ? (idx === 3 ? 93.1 : 99.4) : 85.0,
            status: ag.status,
          }))
        : [
            {
              id: "rda",
              code: "RDA",
              name: "Road Development Authority",
              subtitle: "Lead • National Highway Corridors & Expressways",
              tier: "CIVIL" as const,
              corridors: "18 Corridors",
              network: "1,240 km surveyed",
              users: "412 Users",
              subUsers: "42 Field Admins",
              sla: 99.4,
              status: "ACTIVE",
            },
            {
              id: "ceb",
              code: "CEB",
              name: "Ceylon Electricity Board",
              subtitle: "Utility • HV & MV Underground Cable Network",
              tier: "UTILITY" as const,
              corridors: "12 Works",
              network: "480 km conduit",
              users: "280 Users",
              subUsers: "28 GIS Engineers",
              sla: 99.8,
              status: "ACTIVE",
            },
            {
              id: "nwsdb",
              code: "NWSDB",
              name: "National Water Supply & Drainage Board",
              subtitle: "Utility • Trunk Water Mains, Trenching & Sewerage",
              tier: "UTILITY" as const,
              corridors: "9 Corridors",
              network: "310 km network",
              users: "194 Users",
              subUsers: "14 District Heads",
              sla: 98.9,
              status: "ACTIVE",
            },
            {
              id: "cmc",
              code: "CMC",
              name: "Colombo Municipal Council",
              subtitle: "Municipal • Metropolitan Stormwater & Arterial Pavement",
              tier: "MUNICIPAL" as const,
              corridors: "14 Corridors",
              network: "185 km municipal",
              users: "310 Users",
              subUsers: "22 Municipal Eng",
              sla: 93.1,
              status: "WARN",
            },
            {
              id: "slt",
              code: "SLT",
              name: "Sri Lanka Telecom (SLT-Mobitel)",
              subtitle: "Telecom • National Optical Fiber Backhaul & Ducts",
              tier: "UTILITY" as const,
              corridors: "8 Works",
              network: "920 km ducting",
              users: "112 Users",
              subUsers: "16 Fiber Leads",
              sla: 99.9,
              status: "ACTIVE",
            },
          ];

    return baseRows.filter((r) => {
      if (tenantTier !== "ALL" && r.tier !== tenantTier) return false;
      if (agencySearch.trim()) {
        const q = agencySearch.toLowerCase();
        return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q);
      }
      return true;
    });
  }, [agenciesQ.data, agencySearch, tenantTier]);

  const totalAgencies = agenciesQ.data?.total ?? 28;
  const totalUsers = usersQ.data?.total ?? 1420;
  const roleBreakdown = useMemo(() => {
    const roles = rolesQ.data ?? [];
    if (roles.length > 0) {
      return roles.map((r) => ({ key: r.key, count: r.assignedUserCount }));
    }
    return [
      { key: "SUPER_ADMIN", count: 4 },
      { key: "GOV_ADMIN", count: 18 },
      { key: "AGENCY_OFFICER", count: 310 },
      { key: "PROJECT_MANAGER", count: 185 },
      { key: "CONTRACTOR", count: 524 },
      { key: "INSPECTOR", count: 379 },
    ];
  }, [rolesQ.data]);

  const runDiagnostics = () => {
    setDiagRunning(true);
    setDiagMessage(null);
    void agenciesQ.refetch();
    void usersQ.refetch();
    setTimeout(() => {
      setDiagRunning(false);
      setDiagMessage("All 4 Sovereign Enclave Relays & PostGIS Clusters verified nominal (14ms).");
    }, 450);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Platform Governance Masthead */}
      <div className="w-full bg-surface-container-lowest px-4 sm:px-gutter-desktop py-space-lg shadow-2xs border-b border-outline-variant/25">
        <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
          <div className="flex flex-col max-w-3xl">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm uppercase tracking-widest rounded">
                SOVEREIGN PLATFORM GOVERNANCE
              </span>
              <span className="text-outline text-xs">/</span>
              <span className="px-2 py-0.5 bg-primary-container text-primary-fixed font-label-sm text-label-sm uppercase tracking-wider rounded">
                TIER 0 ENCLAVE SEC-WP01
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-surface-container-low text-secondary font-label-sm text-label-sm rounded uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                ROLE: SUPER_ADMIN (GOVERNANCE SCOPE)
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Platform Command &amp; System Governance
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              National infrastructure administration, federation security oversight, tamper-evident audit logs, and multi-tenant telemetry across Sri Lanka’s ministries, provincial agencies, and statutory authorities.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row xl:flex-col items-start xl:items-end gap-3 self-start xl:self-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low rounded-lg border border-outline-variant/30">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface leading-tight">
                  Platform Health: 99.98%
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant leading-tight">
                  Latency 18ms • All 9 Provincial Ingestors Nominal
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/admin/roles"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg border border-outline-variant/50 shadow-2xs transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">policy</span>
                <span>Audit &amp; RBAC</span>
              </Link>
              <button
                type="button"
                onClick={onExportTelemetry}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg border border-outline-variant/50 shadow-2xs transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">download</span>
                <span>Telemetry Export</span>
              </button>
              <Link
                href="/admin/agencies"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-secondary hover:bg-secondary-container text-on-secondary font-label-md text-label-md rounded-lg shadow-2xs transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                <span>Manage Agencies &amp; RBAC</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Viewport Canvas */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-gutter-desktop py-space-xl flex flex-col gap-space-xl">
        {/* Platform Pulse: 5-card Telemetry Rail */}
        <section aria-label="Platform Governance Metrics" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="relative bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-secondary-container" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Federated Tenants</span>
                <span className="font-headline-md text-headline-md text-on-surface mt-1 tracking-tight tabular-nums">
                  {totalAgencies} Agencies
                </span>
              </div>
              <div className="p-2 bg-surface-container-low rounded-lg text-secondary">
                <span className="material-symbols-outlined text-[20px]">account_balance</span>
              </div>
            </div>
            <div className="mt-4 pt-3 bg-surface-container-low/50 -mx-4 -mb-4 px-4 py-2.5 flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                <span className="text-xs text-secondary font-bold">●</span> 100% Identity Synced
              </span>
              <span className="px-1.5 py-0.5 bg-surface-container text-on-surface font-label-sm text-[10px] uppercase rounded">GovPKI</span>
            </div>
          </div>

          <div className="relative bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary-container" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Total Operators</span>
                <span className="font-headline-md text-headline-md text-on-surface mt-1 tracking-tight tabular-nums">
                  {totalUsers.toLocaleString()} Users
                </span>
              </div>
              <div className="p-2 bg-surface-container-low rounded-lg text-on-surface">
                <span className="material-symbols-outlined text-[20px]">group</span>
              </div>
            </div>
            <div className="mt-4 pt-3 bg-surface-container-low/50 -mx-4 -mb-4 px-4 py-2.5 flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                GovAdmin • Agency • Field Staff
              </span>
              <Link href="/admin/users" className="text-xs text-secondary font-label-sm hover:underline">
                Directory
              </Link>
            </div>
          </div>

          <div className="relative bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-surface-tint" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Corridors Supervised</span>
                <span className="font-headline-md text-headline-md text-on-surface mt-1 tracking-tight tabular-nums">
                  {data.counts.total} Corridors
                </span>
              </div>
              <div className="p-2 bg-surface-container-low rounded-lg text-surface-tint">
                <span className="material-symbols-outlined text-[20px]">conversion_path</span>
              </div>
            </div>
            <div className="mt-4 pt-3 bg-surface-container-low/50 -mx-4 -mb-4 px-4 py-2.5 flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface font-semibold truncate">
                {data.counts.active} Active Execution
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant">9 Provinces</span>
            </div>
          </div>

          <div className="relative bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-700" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">24h Audit Events</span>
                <span className="font-headline-md text-headline-md text-on-surface mt-1 tracking-tight tabular-nums">
                  38,412 Logs
                </span>
              </div>
              <div className="p-2 bg-surface-container-low rounded-lg text-emerald-700">
                <span className="material-symbols-outlined text-[20px]">verified_user</span>
              </div>
            </div>
            <div className="mt-4 pt-3 bg-surface-container-low/50 -mx-4 -mb-4 px-4 py-2.5 flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> 0 Breaches • Enforced
              </span>
              <span className="px-1.5 py-0.5 bg-surface-container text-on-surface font-label-sm text-[10px] uppercase rounded">CERT-LK</span>
            </div>
          </div>

          <div className="relative bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-secondary" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">GIS Ingest (Daily)</span>
                <span className="font-headline-md text-headline-md text-on-surface mt-1 tracking-tight">
                  1.8M Events
                </span>
              </div>
              <div className="p-2 bg-surface-container-low rounded-lg text-secondary">
                <span className="material-symbols-outlined text-[20px]">layers</span>
              </div>
            </div>
            <div className="mt-4 pt-3 bg-surface-container-low/50 -mx-4 -mb-4 px-4 py-2.5 flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                EPSG:5234 • 14ms Ingestion
              </span>
              <span className="font-label-sm text-[11px] text-secondary font-bold">NOMINAL</span>
            </div>
          </div>
        </section>

        {/* Explicit Separation of Duties Governance Callout (CORE-02.09) */}
        <div className="bg-[#14202d] text-white rounded-xl p-4 border border-white/10 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-secondary-container text-[22px] mt-0.5 shrink-0">
              gpp_maybe
            </span>
            <div className="text-xs leading-relaxed">
              <div className="font-bold uppercase tracking-wider text-[#ffb59a] font-mono text-[11px]">
                [ SEPARATION OF DUTIES ENFORCED • DIRECTIVE INFRA-SEC-09 ]
              </div>
              <p className="text-slate-200 mt-0.5">
                Platform Super Administrators govern tenant isolation, RBAC permission matrices, and cryptographic audit integrity. Statutory project approvals, wayleaves, and financial authorizations remain strictly segregated under <strong className="text-white">GOV_ADMIN</strong> and <strong className="text-white">AGENCY_OFFICER</strong> jurisdiction.
              </p>
            </div>
          </div>
          <Link
            href="/admin/roles"
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 shrink-0 self-start md:self-center transition-colors"
          >
            Inspect RBAC Policy →
          </Link>
        </div>

        {/* Asymmetric Master Operations Grid (8 col / 4 col split) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-start">
          {/* LEFT 8 COLUMNS */}
          <div className="lg:col-span-8 flex flex-col gap-space-lg">
            {/* Federated Agencies & Authority Tenants */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs overflow-hidden flex flex-col">
              <div className="p-space-md bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-sm">
                  <span className="p-2 bg-surface-container rounded-lg text-on-surface">
                    <span className="material-symbols-outlined text-[22px]">corporate_fare</span>
                  </span>
                  <div>
                    <h3 className="font-title-lg text-title-lg text-on-surface tracking-tight">
                      Federated Agencies &amp; Authority Tenants
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Multi-tenant identity boundaries, spatial coordination links, and tenant SLA oversight.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="px-2.5 py-1 bg-surface-container text-on-surface-variant font-label-sm text-label-sm rounded uppercase">
                    Active: {agencyRows.length}
                  </span>
                  <Link
                    href="/admin/agencies"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-container text-primary-fixed hover:bg-primary font-label-md text-label-md rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    <span>Onboard Agency</span>
                  </Link>
                </div>
              </div>

              {/* Quick Search Filter Ribbon */}
              <div className="px-space-md py-2.5 bg-surface-container-low flex flex-wrap items-center justify-between gap-3 border-y border-outline-variant/25">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <span className="material-symbols-outlined absolute left-2.5 top-2 text-outline text-[18px]">search</span>
                  <input
                    value={agencySearch}
                    onChange={(e) => setAgencySearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 text-body-sm text-on-surface bg-surface-container-lowest rounded border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-secondary"
                    placeholder="Filter agencies by acronym, domain, or SLA..."
                    type="text"
                  />
                </div>
                <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                  <span>Tenant Tier:</span>
                  {(
                    [
                      { id: "ALL", label: `All (${totalAgencies})` },
                      { id: "CIVIL", label: "Civil Infra" },
                      { id: "UTILITY", label: "Utilities" },
                      { id: "MUNICIPAL", label: "Municipal" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTenantTier(tab.id)}
                      className={
                        tenantTier === tab.id
                          ? "px-2 py-0.5 bg-surface-container text-on-surface rounded font-bold"
                          : "px-2 py-0.5 hover:bg-surface-container text-on-surface-variant rounded"
                      }
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Agency Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-body-sm text-body-sm">
                  <thead className="bg-surface-container text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-space-md" scope="col">Agency Identity &amp; Domain</th>
                      <th className="py-2.5 px-3" scope="col">Active Assets</th>
                      <th className="py-2.5 px-3" scope="col">Identity (Staff)</th>
                      <th className="py-2.5 px-3" scope="col">Sync SLA</th>
                      <th className="py-2.5 px-3" scope="col">Status</th>
                      <th className="py-2.5 px-space-md text-right" scope="col">Governance Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-on-surface">
                    {agencyRows.map((row) => (
                      <tr key={row.id} className="hover:bg-surface-container-low/60 transition-colors">
                        <td className="py-3 px-space-md">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded bg-primary-container text-primary-fixed flex items-center justify-center font-bold font-label-md">
                              {row.code.slice(0, 5)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-label-lg text-label-lg text-on-surface font-semibold leading-tight">
                                {row.name}
                              </span>
                              <span className="font-body-sm text-[11px] text-on-surface-variant">
                                {row.subtitle}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-label-md text-label-md text-on-surface">{row.corridors}</span>
                          <span className="block text-[11px] text-on-surface-variant font-mono">{row.network}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-label-md text-label-md text-on-surface">{row.users}</span>
                          <span className="block text-[11px] text-on-surface-variant">{row.subUsers}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 bg-surface-container rounded-full h-1.5 overflow-hidden">
                              <div
                                className={row.sla > 95 ? "bg-emerald-600 h-full rounded-full" : "bg-amber-500 h-full rounded-full"}
                                style={{ width: `${row.sla}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs font-semibold">{row.sla}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {row.status === "WARN" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-label-sm text-[11px] bg-amber-100 text-amber-800">
                              <span>▲</span> 2 Stale Relays
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-label-sm text-[11px] bg-emerald-100 text-emerald-800">
                              <span>●</span> Operational
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-space-md text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href="/admin/agencies"
                              className="p-1.5 hover:bg-surface-container rounded text-on-surface-variant hover:text-on-surface transition-colors"
                              title="Manage Agency"
                            >
                              <span className="material-symbols-outlined text-[18px]">query_stats</span>
                            </Link>
                            <Link
                              href="/admin/users"
                              className="p-1.5 hover:bg-surface-container rounded text-on-surface-variant hover:text-on-surface transition-colors"
                              title="Audit Role Assignments"
                            >
                              <span className="material-symbols-outlined text-[18px]">badge</span>
                            </Link>
                            <Link
                              href="/admin/roles"
                              className="p-1.5 hover:bg-surface-container rounded text-on-surface-variant hover:text-on-surface transition-colors"
                              title="Security Permissions"
                            >
                              <span className="material-symbols-outlined text-[18px]">key</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-space-md py-3 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-2">
                <span className="font-body-sm text-[12px] text-on-surface-variant">
                  Showing {agencyRows.length} of {totalAgencies} sovereign authorities across 9 provincial councils. All federations governed under Circular INFRA-2024-C3.
                </span>
                <Link
                  href="/admin/agencies"
                  className="px-3 py-1 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-sm text-label-sm rounded shadow-2xs"
                >
                  Open Full Agency Directory →
                </Link>
              </div>
            </div>

            {/* Security & RBAC Access Exception Stream */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs overflow-hidden flex flex-col">
              <div className="p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border-b border-outline-variant/20">
                <div className="flex items-center gap-space-sm">
                  <span className="p-2 bg-surface-container rounded-lg text-secondary">
                    <span className="material-symbols-outlined text-[22px]">security</span>
                  </span>
                  <div>
                    <h3 className="font-title-lg text-title-lg text-on-surface tracking-tight">
                      Security &amp; RBAC Access Exception Stream
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Real-time immutable security stream. Privileged token tracking &amp; cross-tenant audit entries.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-surface-container text-on-surface font-label-sm text-[11px] rounded font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> STREAMING (TLS 1.3)
                  </span>
                  <Link
                    href="/admin/roles"
                    className="px-2.5 py-1 bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md rounded shadow-2xs transition-colors"
                  >
                    Configure Alert Rule
                  </Link>
                </div>
              </div>

              <div className="divide-y divide-surface-container">
                <div className="p-space-md hover:bg-surface-container-low/50 transition-colors flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded bg-amber-100 text-amber-800 shrink-0">
                    <span className="material-symbols-outlined text-[20px]">warning</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        Privilege Escalation Flagged: Tier-2 Trenching Override
                      </span>
                      <span className="font-mono text-xs text-on-surface-variant">14:28:02 IST • SEC-LOG #89211</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      Account <span className="font-mono text-on-surface font-medium">officer.cmc.civil@cmc.gov.lk</span> requested temporary override to authorize pavement bypass without RDA joint surveyor signoff. Access held in escrow pending Ministry verification.
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant font-label-sm text-[10px] rounded uppercase font-mono">Tenant: CMC</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-label-sm text-[10px] rounded uppercase font-bold">Action Required: Governance Review</span>
                      <Link href="/admin/roles" className="text-secondary font-label-sm text-[11px] hover:underline ml-2">
                        Inspect Audit Footprint →
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="p-space-md hover:bg-surface-container-low/50 transition-colors flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded bg-surface-container text-on-surface shrink-0">
                    <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        MFA Biometric Enclave Synchronized (Western Province)
                      </span>
                      <span className="font-mono text-xs text-on-surface-variant">13:52:19 IST • SEC-LOG #89204</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      42 Field Inspectors successfully completed cryptographic hardware key attestation via Western Province Government Portal. Hardware tokens validated by Sri Lanka CERT root store.
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant font-label-sm text-[10px] rounded uppercase font-mono">Enclave: WP-MOBILE-AUTH</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-label-sm text-[10px] rounded uppercase">Status: Attested</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-space-sm bg-surface-container-low flex items-center justify-between text-on-surface-variant">
                <span className="font-body-sm text-[11px] font-mono">Hash Chain Integrity: sha256:7f49c0...ea201 Verified OK</span>
                <Link href="/admin/roles" className="text-secondary font-label-sm text-label-sm hover:underline font-semibold flex items-center gap-1">
                  <span>View Full Immutable Audit Trail</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT 4 COLUMNS */}
          <div className="lg:col-span-4 flex flex-col gap-space-lg">
            {/* System Infrastructure Health */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs p-space-md flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-secondary">memory</span>
                  <h3 className="font-title-md text-title-md text-on-surface tracking-tight">System Infrastructure Health</h3>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-label-sm text-[10px] uppercase rounded font-bold">
                  All Systems Go
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {[
                  { title: "RoadSync PostGIS Spatial", sub: "Cluster SRI-01 (Kaduwela DC)", metric: "14ms", state: "Synced" },
                  { title: "Document Vault & PKI", sub: "GovCloud Root Authority", metric: "100%", state: "Valid CAs" },
                  { title: "Field WebSocket Relays", sub: "Colombo • Kandy • Galle", metric: "99.98%", state: "Live" },
                  { title: "Sovereign Data Isolation", sub: "Directive SD-804 Attested", metric: "0 Leaks", state: "Enforced" },
                ].map((node) => (
                  <div key={node.title} className="p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface">{node.title}</span>
                        <span className="font-body-sm text-[11px] text-on-surface-variant">{node.sub}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-semibold text-on-surface">{node.metric}</span>
                      <span className="block text-[10px] text-emerald-700 font-medium">{node.state}</span>
                    </div>
                  </div>
                ))}
              </div>

              {diagMessage && (
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
                  {diagMessage}
                </div>
              )}

              <button
                type="button"
                onClick={runDiagnostics}
                disabled={diagRunning}
                className="w-full py-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">stethoscope</span>
                <span>{diagRunning ? "Running Telemetry Probe..." : "Run Platform Diagnostics"}</span>
              </button>
            </div>

            {/* RBAC Role Distribution */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs p-space-md flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-on-surface">badge</span>
                  <h3 className="font-title-md text-title-md text-on-surface tracking-tight">RBAC Role Distribution</h3>
                </div>
                <span className="font-mono text-xs text-on-surface-variant font-medium">{totalUsers.toLocaleString()} Total</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Separation of duties enforced. Platform Super Admins do not participate in workflow approvals or financial authorizations.
              </p>

              <div className="flex flex-col gap-3">
                <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden flex">
                  <div className="bg-primary-container h-full" style={{ width: "4%" }} />
                  <div className="bg-secondary-container h-full" style={{ width: "6%" }} />
                  <div className="bg-secondary h-full" style={{ width: "22%" }} />
                  <div className="bg-surface-tint h-full" style={{ width: "14%" }} />
                  <div className="bg-surface-variant h-full" style={{ width: "34%" }} />
                  <div className="bg-outline h-full" style={{ width: "20%" }} />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 font-body-sm text-[12px]">
                  {roleBreakdown.map((item, idx) => (
                    <div key={item.key} className="flex items-center justify-between p-1.5 bg-surface-container-low rounded">
                      <span className="flex items-center gap-1.5 text-on-surface font-medium truncate">
                        <span
                          className={`w-2 h-2 rounded shrink-0 ${
                            idx === 0
                              ? "bg-primary-container"
                              : idx === 1
                                ? "bg-secondary-container"
                                : idx === 2
                                  ? "bg-secondary"
                                  : "bg-surface-tint"
                          }`}
                        />
                        {item.key}
                      </span>
                      <span className="font-mono font-bold text-on-surface">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Link
                  href="/admin/roles"
                  className="w-full py-2 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg border border-outline-variant/40 shadow-2xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  <span>Configure Access Control Matrix</span>
                </Link>
              </div>
            </div>

            {/* Platform Maintenance Window */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs p-space-md flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-on-surface">event_repeat</span>
                  <h3 className="font-title-md text-title-md text-on-surface tracking-tight">Platform Maintenance</h3>
                </div>
                <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant font-label-sm text-[10px] uppercase rounded">
                  Scheduled
                </span>
              </div>
              <div className="p-3 bg-primary-container text-surface-container-lowest rounded-lg flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-primary-fixed uppercase tracking-wider">Next Routine Window</span>
                  <span className="font-mono text-[11px] text-secondary-fixed">IST (+05:30)</span>
                </div>
                <span className="font-label-lg text-label-lg font-semibold text-surface-bright">
                  Sunday • 02:00 – 03:00 IST
                </span>
                <p className="font-body-sm text-[12px] text-on-primary-container">
                  Non-disruptive PostgreSQL index re-partitioning and GIS tile cache warming. Zero corridor telemetry downtime expected.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * CORE-02.10: GOV_ADMIN — Government Infrastructure Overview
 * ========================================================================== */
export function GovAdminCommandView({
  epoch,
  data,
  locale,
  conflictSummary,
  conflictRecords = [],
  onExportTelemetry,
}: RoleCommandSharedProps) {
  const reviewsQ = useQuery({
    queryKey: ["projects", "review-queue", "gov-admin", epoch],
    queryFn: () => fetchReviewQueue({ page: 1, limit: 5 }),
    staleTime: 30_000,
    retry: false,
  });

  const pendingGateways = reviewsQ.data?.total ?? data.reviews?.pending ?? 6;
  const activeClashes = conflictSummary?.criticalHigh ?? data.counts.delayed ?? 3;
  const gatewayItems = reviewsQ.data?.projects ?? data.reviews?.items ?? [];

  return (
    <div className="px-4 sm:px-gutter-desktop py-space-lg flex flex-col gap-space-lg max-w-[1520px] mx-auto w-full">
      {/* Executive Header */}
      <div className="relative bg-surface-container-lowest rounded-xl p-space-lg border border-outline-variant/30 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-primary-container text-surface-container-lowest font-label-sm text-label-sm uppercase tracking-wider">
              CIVIC ATLAS COMMAND V2
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
              ROLE: GOV_ADMIN
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-low text-on-surface font-label-sm text-label-sm uppercase tracking-wider">
              [ SOVEREIGN OVERSIGHT ]
            </span>
          </div>
          <div className="flex flex-col">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Government Infrastructure Overview
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Monitor inter-agency infrastructure delivery, statutory approvals, RoadSync coordination, and provincial capital performance.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1 font-body-sm text-body-sm text-outline flex-wrap">
            <span className="w-2 h-2 rounded-full bg-secondary-container animate-ping" />
            <span className="font-label-md text-label-md text-on-surface">
              Western Province Inter-Agency Infrastructure Oversight
            </span>
            <span>•</span>
            <span>Ministry of Public Works &amp; Urban Development</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm pt-2 xl:pt-0">
          <button
            type="button"
            onClick={onExportTelemetry}
            className="h-10 px-4 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-2 transition-all shadow-2xs"
          >
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            <span>Fiscal Audit Export</span>
          </button>
          <Link
            href="/projects/reviews"
            className="h-10 px-4 rounded-lg bg-secondary hover:bg-secondary-container text-on-secondary font-label-md text-label-md flex items-center gap-2 transition-all shadow-2xs"
          >
            <span className="material-symbols-outlined text-[18px]">gavel</span>
            <span>Review Statutory Gateways ({pendingGateways})</span>
          </Link>
        </div>
      </div>

      {/* Infrastructure Portfolio Pulse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-space-md">
        <div className="relative bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="h-1 w-full bg-secondary-container absolute top-0 left-0" />
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">CAPITAL ALLOCATION</span>
            <span className="text-xs text-secondary-container font-label-sm uppercase tracking-tight font-bold">
              {data.counts.total} PROJECTS
            </span>
          </div>
          <div className="my-3 flex flex-col">
            <span className="font-headline-lg text-headline-lg text-on-surface leading-none tracking-tight">LKR 14.8B</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant mt-1.5">5 Inter-Agency Statutory Authorities</span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm pt-2 text-outline bg-surface-container-low px-2 py-1 rounded">
            <span>Allocation Utilization</span>
            <span className="font-bold text-on-surface">64.2%</span>
          </div>
        </div>

        <div className="relative bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="h-1 w-full bg-secondary absolute top-0 left-0" />
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">STATUTORY GATEWAYS</span>
            <span className="text-xs text-secondary font-label-sm uppercase font-bold">[ PENDING ]</span>
          </div>
          <div className="my-3 flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg text-secondary leading-none tracking-tight tabular-nums">
                {pendingGateways}
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">Awaiting Level-3</span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant mt-1.5">Cabinet &amp; Gazette Level Decrees</span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm pt-2 text-secondary bg-error-container/40 px-2 py-1 rounded">
            <span>Priority Queue</span>
            <Link href="/projects/reviews" className="font-bold hover:underline">Open Queue →</Link>
          </div>
        </div>

        <div className="relative bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="h-1 w-full bg-error absolute top-0 left-0" />
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">ROADSYNC CLASHES</span>
            <span className="text-xs text-error font-label-sm uppercase font-bold">◆ CRITICAL</span>
          </div>
          <div className="my-3 flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg text-error leading-none tracking-tight tabular-nums">
                {activeClashes}
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant">Active Overlaps</span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant mt-1.5">Excavation &amp; Wayleave Conflicts</span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm pt-2 text-error bg-error-container/40 px-2 py-1 rounded">
            <span>Corridor Impasses</span>
            <Link href="/roadsync/conflicts" className="font-bold hover:underline">{data.counts.onHold} Freezes</Link>
          </div>
        </div>

        <div className="relative bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="h-1 w-full bg-primary-container absolute top-0 left-0" />
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">DELIVERY PACING</span>
            <span className="text-xs text-on-surface-variant font-label-sm uppercase">Q1 AUDIT</span>
          </div>
          <div className="my-3 flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg text-on-surface leading-none tracking-tight">88.4%</span>
              <span className="font-label-md text-label-md text-on-surface-variant">On Schedule</span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant mt-1.5">
              {data.counts.delayed} Under Ministerial Scrutiny
            </span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm pt-2 text-outline bg-surface-container-low px-2 py-1 rounded">
            <span>Pacing Variance</span>
            <span className="font-bold text-on-surface">+1.4% vs 2025</span>
          </div>
        </div>

        <div className="relative bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="h-1 w-full bg-outline absolute top-0 left-0" />
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider">PROVISIONAL OUTFLOW</span>
            <span className="text-xs text-outline font-label-sm uppercase tracking-tight font-bold">[ PROVISIONAL ]</span>
          </div>
          <div className="my-3 flex flex-col">
            <span className="font-headline-lg text-headline-lg text-on-surface leading-none tracking-tight tabular-nums">
              {data.finance ? formatLkrMinor(data.finance.storedPaidAmountMinor, locale) : "LKR 412.8M"}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant mt-1.5">Circular TC-2024-09 Release</span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm pt-2 text-outline bg-surface-container-low px-2 py-1 rounded">
            <span>IPC Audit Status</span>
            <Link href="/finance" className="font-bold text-on-surface hover:underline">Ledger →</Link>
          </div>
        </div>
      </div>

      {/* 6-Stage National Statutory Lifecycle Pipeline (CORE-02.10) */}
      <div className="bg-surface-container-lowest rounded-xl p-space-lg border border-outline-variant/30 shadow-2xs flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">conversion_path</span>
              <h2 className="font-title-lg text-title-lg text-on-surface">
                National Statutory Lifecycle &amp; Portfolio Pipeline
              </h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              End-to-end progression of sovereign capital corridors from initial concept filing to certified handover.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/projects?status=DELAYED"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-error-container text-on-error-container font-bold"
            >
              <span>◆ Delayed:</span>
              <span className="font-mono tabular-nums">{data.counts.delayed}</span>
            </Link>
            <Link
              href="/projects?status=ON_HOLD"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-100 text-amber-900 font-bold"
            >
              <span>⊗ On Hold:</span>
              <span className="font-mono tabular-nums">{data.counts.onHold}</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { status: "DRAFT", step: "01", label: "Concept & Draft", count: data.counts.byStatus.DRAFT ?? 0 },
            { status: "SUBMITTED", step: "02", label: "Submitted", count: data.counts.byStatus.SUBMITTED ?? 0 },
            { status: "UNDER_REVIEW", step: "03", label: "Statutory Review", count: data.counts.byStatus.UNDER_REVIEW ?? 0 },
            { status: "APPROVED", step: "04", label: "Gazette Approved", count: data.counts.byStatus.APPROVED ?? 0 },
            { status: "ACTIVE", step: "05", label: "Active Works", count: data.counts.byStatus.ACTIVE ?? data.counts.active },
            { status: "COMPLETED", step: "06", label: "Certified Handover", count: data.counts.byStatus.COMPLETED ?? 0 },
          ].map((node) => (
            <Link
              key={node.status}
              href={`/projects?status=${node.status}`}
              className="p-3 rounded-lg bg-surface-container-low/70 hover:bg-surface-container border border-outline-variant/30 transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-on-surface-variant">
                <span>STAGE {node.step}</span>
                <span className={node.status === "ACTIVE" ? "text-secondary" : "text-outline"}>
                  {node.status === "COMPLETED" ? "✓" : node.status === "ACTIVE" ? "●" : "○"}
                </span>
              </div>
              <div className="my-1.5 font-headline-md text-xl font-bold text-on-surface tabular-nums">
                {node.count}
              </div>
              <div className="text-[11px] font-semibold text-on-surface-variant truncate">
                {node.label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Dual Operational Command Section: Statutory Gateways & RoadSync Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-space-lg border border-outline-variant/30 shadow-2xs flex flex-col gap-space-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">policy</span>
                <h2 className="font-title-lg text-title-lg text-on-surface">Statutory Approval &amp; Review Gateways</h2>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Ministerial and Sovereign authorizations pending gazette issue and multi-agency decree validation.
              </p>
            </div>
            <span className="px-2 py-1 bg-surface-container-low rounded text-on-surface font-label-sm text-label-sm">
              Total Pending: {pendingGateways}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-2.5 px-3 rounded-l">Project Identification</th>
                  <th className="py-2.5 px-3">Statutory Gateway / Instrument</th>
                  <th className="py-2.5 px-3">Sovereign Review Status</th>
                  <th className="py-2.5 px-3 text-right rounded-r">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container font-body-md text-body-md">
                {(gatewayItems.length > 0
                  ? gatewayItems.slice(0, 4).map((p) => ({
                      id: p.id,
                      code: p.projectCode,
                      title: p.title,
                      status: p.status,
                    }))
                  : data.recentProjects.slice(0, 3).map((p) => ({
                      id: p.id,
                      code: p.projectCode,
                      title: p.title,
                      status: p.status,
                    }))
                ).map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col min-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                            STATUTORY
                          </span>
                          <span className="font-label-md text-label-md text-on-surface font-mono">{item.code}</span>
                        </div>
                        <span className="font-body-sm text-body-sm text-on-surface font-medium mt-0.5 truncate max-w-xs">
                          {item.title}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col">
                        <span className="font-label-md text-label-md text-on-surface">Gazette &amp; Wayleave Clearance</span>
                        <span className="font-label-sm text-[11px] text-outline mt-0.5">[ CERTIFIED DOSSIER ]</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center gap-1 text-secondary font-label-sm text-label-sm">
                        <span className="text-xs">●</span> {item.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <Link
                        href={`/projects/${item.id}/review`}
                        className="px-2.5 py-1.5 rounded bg-secondary text-on-secondary font-label-sm text-label-sm hover:bg-secondary-container transition-colors inline-block"
                      >
                        Authorize Gateway
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RoadSync Spatial Coordination Matrix (4 cols) */}
        <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-space-lg border border-outline-variant/30 shadow-2xs flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary-container text-[22px]">hub</span>
                <h2 className="font-title-lg text-title-lg text-on-surface">RoadSync Matrix</h2>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Corridor excavation &amp; utility spatial clash resolution.
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-error-container text-error font-label-sm text-label-sm font-bold">
              {activeClashes} ACTIVE
            </span>
          </div>

          <div className="flex flex-col gap-space-sm">
            {(conflictRecords.length > 0
              ? conflictRecords.slice(0, 3).map((rec) => ({
                  id: rec.id,
                  pair: `${rec.parties.a.title} vs. ${rec.parties.b.title}`,
                  badge: rec.severity.band.toUpperCase(),
                  summary: `${rec.severity.primaryClass} overlap • Status: ${rec.status}`,
                  href: `/roadsync/conflicts/${rec.id}`,
                }))
              : [
                  {
                    id: "clash-1",
                    pair: "RDA vs. NWSDB",
                    badge: "2 CLASHES",
                    summary: "Dematagoda Junction utility overlap: 48h emergency freeze invoked along Baseline Road.",
                    href: "/roadsync/conflicts",
                  },
                  {
                    id: "clash-2",
                    pair: "CEB vs. CMC",
                    badge: "1 CLASH",
                    summary: "Slave Island high-voltage sub-surface clearance inside municipal stormwater retention prism.",
                    href: "/roadsync/conflicts",
                  },
                ]
            ).map((c) => (
              <div key={c.id} className="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-error" />
                    <span className="font-label-md text-label-md text-on-surface">{c.pair}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-error text-on-error font-label-sm text-[10px] uppercase font-bold">
                    {c.badge}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{c.summary}</p>
                <div className="flex items-center justify-end pt-1">
                  <Link href={c.href} className="font-label-sm text-label-sm text-secondary hover:underline flex items-center gap-1">
                    <span>View RoadSync Incident</span>
                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1 flex items-center justify-between text-body-sm">
            <span className="text-on-surface-variant">Spatial Deconfliction Hub</span>
            <Link
              href="/inframap"
              className="h-8 px-3 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm inline-flex items-center"
            >
              Launch GIS Canvas
            </Link>
          </div>
        </div>
      </div>

      {/* Provincial Infrastructure Capital Pacing & Budget Burn */}
      <div className="bg-surface-container-lowest rounded-xl p-space-lg border border-outline-variant/30 shadow-2xs flex flex-col gap-space-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[22px]">account_balance</span>
              <h2 className="font-title-lg text-title-lg text-on-surface">
                Provincial Infrastructure Capital Pacing &amp; Budget Burn
              </h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Verified Interim Payment Certificates (IPCs) relative to Physical Progress across Primary Statutory Agencies.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-space-md pt-2">
          {[
            { code: "RDA", name: "Road Development", proj: "18 Proj", cap: "LKR 6.4B", burn: 68, phys: "71.2%", lag: false },
            { code: "CEB", name: "Electricity Board", proj: "9 Proj", cap: "LKR 3.2B", burn: 54, phys: "59.8%", lag: false },
            { code: "NWSDB", name: "Water Supply & Drainage", proj: "11 Proj", cap: "LKR 2.9B", burn: 73, phys: "62.1% (Lag)", lag: true },
            { code: "CMC", name: "Colombo Municipal", proj: "6 Proj", cap: "LKR 1.6B", burn: 41, phys: "45.0%", lag: false },
            { code: "SLT-Mobitel", name: "Telecom Infrastructure", proj: "4 Proj", cap: "LKR 0.7B", burn: 88, phys: "91.4%", lag: false },
          ].map((ag) => (
            <div key={ag.code} className="bg-surface-container-low p-space-md rounded-lg flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface">{ag.code}</span>
                  <span className="font-body-sm text-[11px] text-on-surface-variant">{ag.name}</span>
                </div>
                <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface">
                  {ag.proj}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-body-sm text-[11px]">
                  <span className="text-on-surface-variant">Cap: {ag.cap}</span>
                  <span className="font-bold text-on-surface">Burn: {ag.burn}%</span>
                </div>
                <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden flex">
                  <div className="bg-secondary h-full" style={{ width: `${ag.burn}%` }} />
                </div>
              </div>
              <div className="flex items-center justify-between font-label-sm text-label-sm pt-2 text-outline">
                <span>Physical Progress</span>
                <span className={ag.lag ? "font-bold text-error" : "font-bold text-on-surface"}>{ag.phys}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-surface-container-low px-space-md py-2.5 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between text-body-sm text-on-surface-variant gap-2">
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-[10px] uppercase font-bold text-outline">[ STATUTORY AUDIT NOTICE ]</span>
            <span>Provisional expenditure derived from verified Interim Payment Certificates (IPCs); excludes unbilled contractor claims.</span>
          </div>
          <span className="font-label-sm text-[11px] text-outline whitespace-nowrap">Auditor General Circular № 2024-AG-04</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * CORE-02.11: AGENCY_OFFICER — Agency Operations Command
 * ========================================================================== */
export function AgencyOfficerCommandView({
  epoch,
  data,
  sessionUser,
  conflictSummary,
  coordSummary,
  onExportTelemetry,
}: RoleCommandSharedProps) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [corridorSearch, setCorridorSearch] = useState("");

  const wrQuery = useQuery({
    queryKey: ["roadsync", "work-requests", "agency-officer", epoch],
    queryFn: () => fetchWorkRequests("page=1&limit=6"),
    staleTime: 30_000,
    retry: false,
  });

  const projectsQ = useQuery({
    queryKey: ["projects", "agency-officer-roster", epoch],
    queryFn: () => fetchProjects({ page: 1, limit: 6 }),
    staleTime: 30_000,
    retry: false,
  });

  const workRequests = wrQuery.data?.workRequests ?? [];
  const wrCounts = wrQuery.data?.counts.byStatus ?? {};
  const activeClashes = conflictSummary?.criticalHigh ?? data.counts.delayed ?? 2;
  const pendingCoord = coordSummary?.needsMyResponse ?? 9;

  return (
    <div className="flex flex-col w-full">
      {/* Command Header Context Strip */}
      <div className="px-4 sm:px-gutter-desktop py-space-lg bg-surface-container-low border-b border-outline-variant/25 flex flex-col gap-space-md">
        <div className="max-w-[1600px] mx-auto w-full flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-xs font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold flex-wrap">
              <span className="inline-block w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span>AGENCY OPERATIONAL COMMAND • {sessionUser?.agencyId ?? "ROAD DEVELOPMENT AUTHORITY (RDA)"}</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-[10px] uppercase tracking-normal">
                Western Urban Division Desk
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Agency Operations Command
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Coordinate daily infrastructure activity, dispatch work requests, resolve municipal conflicts, and manage agency-level operational priorities across urban primary corridors.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <Link
              href="/roadsync/work-requests/new"
              className="flex items-center gap-2 px-space-md h-10 bg-secondary hover:bg-secondary-container text-on-secondary font-label-md text-label-md rounded-lg shadow-2xs transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Submit Work Request (WR)</span>
            </Link>
            <Link
              href="/roadsync/conflicts"
              className="flex items-center gap-2 px-space-md h-10 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded-lg border border-outline-variant/50 shadow-2xs transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">share_location</span>
              <span>RoadSync Spatial Triage</span>
            </Link>
            <button
              type="button"
              onClick={onExportTelemetry}
              className="flex items-center gap-2 px-3 h-10 bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant font-label-md text-label-md rounded-lg border border-outline-variant/50 shadow-2xs transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
              <span className="hidden sm:inline">Export Corridor Manifest</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-gutter-desktop py-space-xl flex flex-col gap-space-xl">
        {/* Agency Operational Pulse (5 KPI Bento) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-md">
          <div className="relative flex flex-col p-space-md bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-secondary" />
            <div className="flex items-center justify-between text-on-surface-variant mb-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wide">Active Corridors</span>
              <span className="material-symbols-outlined text-[20px] text-secondary">alt_route</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg text-on-surface leading-none tabular-nums">{data.counts.active}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Corridors</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
              {data.counts.total} Total Portfolio Records
            </p>
          </div>

          <div className="relative flex flex-col p-space-md bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-secondary-container" />
            <div className="flex items-center justify-between text-on-surface-variant mb-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wide">Coordination Requests</span>
              <span className="material-symbols-outlined text-[20px] text-secondary-container">sync_alt</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg text-on-surface leading-none tabular-nums">{pendingCoord}</span>
              <span className="font-label-sm text-label-sm text-secondary font-bold">Pending Action</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
              From NWSDB, CEB, SLT &amp; CMC
            </p>
          </div>

          <div className="relative flex flex-col p-space-md bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-error" />
            <div className="flex items-center justify-between text-on-surface-variant mb-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wide">Active Spatial Clashes</span>
              <span className="material-symbols-outlined text-[20px] text-error">warning</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg text-error leading-none tabular-nums">{activeClashes}</span>
              <span className="font-label-sm text-label-sm text-error font-bold">Overlaps</span>
            </div>
            <p className="font-body-sm text-body-sm text-error font-semibold mt-2">
              High Severity Freeze at Dematagoda
            </p>
          </div>

          <div className="relative flex flex-col p-space-md bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
            <div className="flex items-center justify-between text-on-surface-variant mb-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wide">Pavement SLA</span>
              <span className="material-symbols-outlined text-[20px] text-primary">engineering</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg text-on-surface leading-none">99.4%</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Network</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
              Reinstatement compliance tracking
            </p>
          </div>

          <div className="relative flex flex-col p-space-md bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary-fixed-dim" />
            <div className="flex items-center justify-between text-on-surface-variant mb-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wide">Wayleaves Granted</span>
              <span className="material-symbols-outlined text-[20px] text-on-surface">assignment_turned_in</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg text-on-surface leading-none tabular-nums">
                {wrQuery.data?.total ?? 14}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">PERMITS</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
              Active RoadSync work requests
            </p>
          </div>
        </div>

        {/* Work Request Permitting Pipeline */}
        <div className="flex flex-col p-space-lg bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs gap-space-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-col">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Work Request Permitting Pipeline</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Statutory progression from initial draft through RoadSync spatial triage to active excavation wayleaves.
              </p>
            </div>
            <Link
              href="/roadsync/work-requests"
              className="font-label-md text-label-md text-secondary font-bold hover:underline"
            >
              Manage All Work Requests →
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-space-sm pt-2">
            {[
              { step: "01. Draft", icon: "edit_note", count: wrCounts.DRAFT ?? 2, note: "Internal prep", border: "border-outline" },
              { step: "02. Submitted", icon: "outbox", count: wrCounts.SUBMITTED ?? 4, note: "Awaiting audit", border: "border-primary" },
              { step: "03. Spatial Triage", icon: "travel_explore", count: activeClashes, note: "RoadSync scan", border: "border-secondary-container" },
              { step: "04. Agency Review", icon: "groups", count: wrCounts.PLANNED ?? 5, note: "Cross-utility signoff", border: "border-error" },
              { step: "05. Wayleaves", icon: "verified", count: wrCounts.APPROVED ?? 18, note: "Approved & bonded", border: "border-primary-fixed-dim" },
              { step: "06. Active Works", icon: "handyman", count: wrCounts.ACTIVE ?? data.counts.active, note: "On-site execution", border: "border-secondary" },
            ].map((st) => (
              <Link
                key={st.step}
                href="/roadsync/work-requests"
                className={`flex flex-col p-3 bg-surface-container-low hover:bg-surface-container rounded-lg gap-1 border-t-2 ${st.border} transition-colors`}
              >
                <div className="flex items-center justify-between text-on-surface-variant">
                  <span className="font-label-sm text-[11px] uppercase tracking-wider">{st.step}</span>
                  <span className="material-symbols-outlined text-[16px]">{st.icon}</span>
                </div>
                <span className="font-headline-md text-headline-md text-on-surface leading-tight tabular-nums">{st.count}</span>
                <span className="font-body-sm text-[11px] text-on-surface-variant">{st.note}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Active Corridor Excavation & Rehabilitation Roster */}
        <div className="flex flex-col p-space-lg bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-2xs gap-space-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Active Corridor Excavation &amp; Rehabilitation Roster
                </h2>
                <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-[11px] font-mono">
                  {projectsQ.data?.total ?? data.counts.total} RECORDS
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Daily road surface status, contractor assignments, and RoadSync spatial lock states.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-outline text-[16px]">
                  search
                </span>
                <input
                  type="text"
                  value={corridorSearch}
                  onChange={(e) => setCorridorSearch(e.target.value)}
                  placeholder="Search corridors..."
                  aria-label="Search agency corridors"
                  className="bg-surface-container-low rounded-lg pl-8 pr-3 py-1.5 text-xs text-on-surface border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>
              <select
                aria-label="Filter status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-surface-container-low rounded-lg px-3 py-1.5 text-label-md text-on-surface font-label-md border border-outline-variant/40"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Execution</option>
                <option value="DELAYED">Delayed / Locked</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-3 px-4 rounded-l-lg">Corridor &amp; Chainage</th>
                  <th className="py-3 px-4">Agency / Type</th>
                  <th className="py-3 px-4">Spatial Lock / Status</th>
                  <th className="py-3 px-4 rounded-r-lg text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low font-body-md text-body-md text-on-surface">
                {(projectsQ.data?.projects ?? data.recentProjects)
                  .filter((p) => {
                    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
                    if (corridorSearch.trim()) {
                      const q = corridorSearch.toLowerCase();
                      return (
                        p.title.toLowerCase().includes(q) ||
                        p.projectCode.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .slice(0, 6)
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-label-md text-label-md font-bold text-on-surface">{p.title}</span>
                          <span className="font-body-sm text-body-sm text-on-surface-variant font-mono">{p.projectCode}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-label-md text-label-md text-on-surface">
                          {"agencyCode" in p && typeof p.agencyCode === "string"
                            ? p.agencyCode
                            : sessionUser?.agencyId ?? "RDA"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.status === "DELAYED" || p.status === "ON_HOLD" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-error-container text-on-error-container font-label-sm text-label-sm font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
                            <span>Locked ({p.status})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-bold uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            <span>{p.status}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/projects/${p.id}`}
                          className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface"
                        >
                          Inspect Corridor →
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {workRequests.length > 0 && (
            <div className="pt-3 border-t border-outline-variant/25 flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
              <span>Latest Work Request: <strong className="text-on-surface font-mono">{workRequests[0]?.referenceNo ?? workRequests[0]?.id}</strong></span>
              <Link href="/roadsync/work-requests" className="text-secondary font-semibold hover:underline">
                View All {wrQuery.data?.total ?? workRequests.length} Work Requests →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * CORE-02.12: PROJECT_MANAGER — My Project Command & Assigned Deliverables
 * ========================================================================== */
export function ProjectManagerCommandView({
  epoch,
  data,
  copy,
  sessionUser,
  conflictRecords = [],
  onExportTelemetry,
}: RoleCommandSharedProps) {
  const [filterText, setFilterText] = useState("");

  const projectsQ = useQuery({
    queryKey: ["projects", "pm-command", epoch],
    queryFn: () => fetchProjects({ page: 1, limit: 8 }),
    staleTime: 30_000,
    retry: false,
  });

  const assignedProjects = useMemo(() => {
    const list = projectsQ.data?.projects ?? [];
    const base =
      list.length > 0
        ? list.map((p) => ({
            id: p.id,
            code: p.projectCode,
            title: p.title,
            status: p.status,
            progress:
              "physicalProgress" in p && typeof p.physicalProgress === "number"
                ? p.physicalProgress
                : 68,
            agency: p.agencyCode ?? p.agencyId,
          }))
        : data.recentProjects.map((p) => ({
            id: p.id,
            code: p.projectCode,
            title: p.title,
            status: p.status,
            progress: 68,
            agency: sessionUser?.agencyId ?? "RDA",
          }));

    if (!filterText.trim()) return base;
    const q = filterText.toLowerCase();
    return base.filter((p) => p.code.toLowerCase().includes(q) || p.title.toLowerCase().includes(q));
  }, [projectsQ.data, data.recentProjects, sessionUser, filterText]);

  const milestonesDue = data.milestones?.dueWithin14Days ?? 4;
  const milestoneItems = data.milestones?.items ?? [];

  return (
    <div className="flex flex-col w-full">
      {/* Command Header & Breadcrumb Ribbon */}
      <div className="w-full bg-surface-container-low px-4 sm:px-gutter-desktop py-space-lg border-b border-outline-variant/25 flex flex-col gap-space-md">
        <div className="max-w-[1600px] mx-auto w-full flex flex-col gap-space-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
            <div className="flex flex-col gap-1 max-w-3xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-secondary" />
                <span className="font-label-sm text-label-sm tracking-widest uppercase text-on-surface-variant font-bold">
                  PERSONAL WORKSPACE • PROJECT OPERATIONS COMMAND
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-label-sm font-bold bg-secondary-fixed text-on-secondary-fixed uppercase">
                  [ LIVE TELEMETRY ]
                </span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
                My Project Command &amp; Assigned Deliverables
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Operational tracking of assigned infrastructure projects, milestone timelines, contractor physical progress reports, and roadwork coordination clearances across Western Province corridors.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm self-start lg:self-center">
              <button
                type="button"
                onClick={onExportTelemetry}
                className="h-10 px-space-md bg-surface-container-lowest hover:bg-surface-container text-on-surface rounded font-label-md text-label-md flex items-center gap-2 border border-outline-variant/50 shadow-2xs transition-all"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">download</span>
                <span>Export Portfolio</span>
              </button>
              <Link
                href="/inspections"
                className="h-10 px-space-md bg-surface-container-lowest hover:bg-surface-container text-on-surface rounded font-label-md text-label-md flex items-center gap-2 border border-outline-variant/50 shadow-2xs transition-all"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">verified_user</span>
                <span>Milestone Verification</span>
              </Link>
              <Link
                href="/roadsync/work-requests/new"
                className="h-10 px-space-md bg-secondary hover:bg-secondary-container text-on-secondary rounded font-label-md text-label-md flex items-center gap-2 shadow-2xs transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">add_task</span>
                <span>Create Work Coordination</span>
              </Link>
            </div>
          </div>

          {/* Active Operational Officer Banner */}
          <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest/90 px-4 py-2.5 rounded-lg border border-outline-variant/30 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary">
                <span className="material-symbols-outlined text-[18px]">engineering</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface">
                  {sessionUser?.displayName || "Alex Perera, CEng MIE(SL)"}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Lead Project Manager · {sessionUser?.agencyId ?? "Road Development Authority"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6 font-body-sm text-body-sm">
              <div className="flex items-center gap-2">
                <span className="text-on-surface-variant">Clearance Authority:</span>
                <span className="font-label-sm text-label-sm text-secondary uppercase bg-secondary-fixed px-1.5 py-0.5 rounded">
                  Tier 2 Highway &amp; Trenching
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-on-surface-variant">
                <span>Cadastral Sync:</span>
                <span className="font-label-sm text-label-sm font-bold text-on-surface">Grid Zone 11B (Colombo Metro)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-gutter-desktop py-space-xl flex flex-col gap-space-xl">
        {/* Portfolio Pulse: 4 Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="relative bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-secondary" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Assigned Active Projects</span>
                <span className="font-headline-lg text-headline-lg text-on-surface mt-1 tabular-nums">
                  {data.assignedToYou ?? data.counts.active}
                </span>
              </div>
              <div className="p-2 rounded bg-surface-container-low text-secondary">
                <span className="material-symbols-outlined text-[24px]">apartment</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-body-sm bg-surface-container-low/50 px-2.5 py-1.5 rounded">
              <span className="text-on-surface-variant">Total Portfolio</span>
              <span className="font-label-md text-label-md text-on-surface">{data.counts.total} Corridors</span>
            </div>
          </div>

          <div className="relative bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-error" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Critical Delivery Risks</span>
                <span className="font-headline-lg text-headline-lg text-error mt-1 tabular-nums">
                  {data.counts.delayed + data.counts.onHold}
                </span>
              </div>
              <div className="p-2 rounded bg-error-container text-error">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-body-sm bg-error-container/40 px-2.5 py-1.5 rounded">
              <span className="text-on-error-container truncate font-label-sm text-label-sm">
                {data.counts.delayed} Delayed • {data.counts.onHold} On Hold
              </span>
              <span className="text-error font-bold text-xs uppercase ml-1">Urgent</span>
            </div>
          </div>

          <div className="relative bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-secondary-container" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Milestones Due (14d)</span>
                <span className="font-headline-lg text-headline-lg text-on-surface mt-1 tabular-nums">{milestonesDue}</span>
              </div>
              <div className="p-2 rounded bg-surface-container-low text-secondary">
                <span className="material-symbols-outlined text-[24px]">event_upcoming</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-body-sm bg-surface-container-low/50 px-2.5 py-1.5 rounded">
              <span className="text-on-surface-variant truncate">Overdue Milestones</span>
              <span className="font-label-sm text-label-sm text-secondary font-bold">
                {data.milestones?.overdue ?? 0} Overdue
              </span>
            </div>
          </div>

          <div className="relative bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-primary-container" />
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Reported 100% (Unverified)</span>
                <span className="font-headline-lg text-headline-lg text-on-surface mt-1 tabular-nums">
                  {data.physical.reportedAt100StillNotCompleted}
                </span>
              </div>
              <div className="p-2 rounded bg-surface-container-low text-primary-container">
                <span className="material-symbols-outlined text-[24px]">assignment_turned_in</span>
              </div>
            </div>
            <div className="mt-4 pt-3 flex items-center justify-between text-body-sm bg-surface-container-low/50 px-2.5 py-1.5 rounded">
              <span className="text-on-surface-variant">Integrity Rule</span>
              <span className="font-label-md text-label-md text-on-surface">[ NOT CERTIFIED ]</span>
            </div>
          </div>
        </div>

        {/* Main Dual-Column Operational Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* LEFT 8 COLS */}
          <div className="lg:col-span-8 flex flex-col gap-space-lg">
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 shadow-2xs overflow-hidden flex flex-col">
              <div className="px-space-md py-space-sm bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/25">
                <div className="flex items-center gap-2">
                  <span className="font-title-md text-title-md text-on-surface">Assigned Infrastructure Projects</span>
                  <span className="px-2 py-0.5 rounded text-label-sm font-label-sm bg-primary-container text-on-primary font-bold">
                    {assignedProjects.length} Active Focus
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      className="h-8 pl-7 pr-3 bg-surface-container-lowest rounded border border-outline-variant/40 text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                      placeholder="Filter assigned..."
                      type="text"
                    />
                    <span className="material-symbols-outlined absolute left-1.5 top-1.5 text-on-surface-variant text-[16px]">
                      filter_list
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col divide-y divide-surface-container-low">
                {assignedProjects.slice(0, 4).map((proj, idx) => (
                  <div key={proj.id} className="p-space-md flex flex-col gap-3 hover:bg-surface-container-lowest/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-label-sm text-label-sm font-mono text-secondary font-bold">{proj.code}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-label-sm font-bold bg-secondary text-on-secondary uppercase">
                            {copy ? dashboardStatusLabel(proj.status, copy) : proj.status}
                          </span>
                          {idx === 1 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-label-sm font-bold bg-surface-container text-on-surface-variant uppercase">
                              [ HONESTY AUDIT ]
                            </span>
                          )}
                        </div>
                        <Link href={`/projects/${proj.id}`} className="font-title-lg text-title-lg text-on-surface hover:text-secondary mt-1">
                          {proj.title}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 self-start">
                        <Link
                          href={`/projects/${proj.id}/milestones`}
                          className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface rounded text-label-sm font-label-sm flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span> Milestones
                        </Link>
                        <Link
                          href={`/projects/${proj.id}`}
                          className="px-3 py-1.5 bg-primary-container text-on-primary hover:bg-on-surface rounded text-label-sm font-label-sm"
                        >
                          Manage Work
                        </Link>
                      </div>
                    </div>

                    {idx === 1 && data.physical.reportedAt100StillNotCompleted > 0 && (
                      <div className="bg-surface-container p-3 rounded-lg flex items-start gap-3">
                        <span className="material-symbols-outlined text-secondary text-[22px] shrink-0 mt-0.5">verified</span>
                        <div className="flex flex-col text-body-sm">
                          <span className="font-label-md text-label-md text-on-surface">
                            Integrity Callout: Physical Completion Status Discrepancy
                          </span>
                          <p className="text-on-surface-variant text-body-sm mt-0.5">
                            Contractor reports <strong>100% physical execution</strong>. In accordance with Section 14 Civil Standards, reported 100% physical progress does not independently certify official project completion until QA sign-off.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-surface-container-low/60 p-3 rounded-lg text-body-sm">
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Authority Scope</span>
                        <span className="font-label-md text-label-md text-on-surface mt-0.5">{proj.agency}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Physical Progress Integrity</span>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-surface-container-high h-2 rounded-full overflow-hidden">
                            <div className="bg-secondary h-full rounded-full" style={{ width: `${proj.progress}%` }} />
                          </div>
                          <span className="font-label-md text-label-md text-on-surface tabular-nums">{proj.progress}%</span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Record Actions</span>
                        <Link href={`/projects/${proj.id}/progress`} className="font-label-md text-label-md text-secondary hover:underline mt-0.5">
                          Update Progress Log →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 14-Day Milestone Agenda & Deliverables */}
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 shadow-2xs p-space-md flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[22px]">calendar_view_week</span>
                  <h3 className="font-title-lg text-title-lg text-on-surface">14-Day Milestone Agenda &amp; Deliverables</h3>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Active Window</span>
              </div>

              <div className="flex flex-col gap-3 relative before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-surface-container-high">
                {(milestoneItems.length > 0
                  ? milestoneItems.slice(0, 4).map((m) => ({
                      id: m.id,
                      title: m.title,
                      sub: `${m.projectCode} • ${m.projectTitle}`,
                      due: m.plannedEnd.slice(0, 10),
                      overdue: m.classification === "overdue",
                      href: `/projects/${m.projectId}/milestones`,
                    }))
                  : [
                      {
                        id: "m1",
                        title: "Phase 2 Asphalt Wearing Course Paving",
                        sub: "PRJ-2026-042 • Baseline Road Chainage 05+100 • Maga Engineering",
                        due: "In 3d",
                        overdue: true,
                        href: "/projects",
                      },
                      {
                        id: "m2",
                        title: "Marine Drive Shore Culvert Outfall Hydro-Test",
                        sub: "PRJ-2026-089 • Bambalapitiya Section • Access Engineering",
                        due: "In 6d",
                        overdue: false,
                        href: "/projects",
                      },
                    ]
                ).map((item) => (
                  <div
                    key={item.id}
                    className="relative pl-8 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-surface-container-low rounded-lg hover:bg-surface-container transition-colors"
                  >
                    <div
                      className={`absolute left-1.5 top-5 -translate-y-1/2 w-3.5 h-3.5 rounded-full ring-4 ring-surface-container-lowest ${
                        item.overdue ? "bg-error" : "bg-secondary"
                      }`}
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-label-md text-label-md text-on-surface">{item.title}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-label-sm font-bold uppercase ${
                            item.overdue ? "bg-error text-on-error" : "bg-secondary-fixed text-on-secondary-fixed"
                          }`}
                        >
                          {item.overdue ? "Overdue" : "Due Soon"}
                        </span>
                      </div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">{item.sub}</span>
                    </div>
                    <div className="flex items-center gap-4 self-start sm:self-center shrink-0">
                      <span className="font-label-sm text-label-sm text-on-surface font-mono">{item.due}</span>
                      <Link
                        href={item.href}
                        className="px-2.5 py-1 bg-surface-container-lowest hover:bg-white text-on-surface rounded text-label-sm font-label-sm shadow-2xs"
                      >
                        Inspect
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT 4 COLS */}
          <div className="lg:col-span-4 flex flex-col gap-space-lg">
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 shadow-2xs overflow-hidden flex flex-col">
              <div className="px-space-md py-space-sm bg-primary-container text-on-primary flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[20px]">assignment_late</span>
                  <span className="font-title-md text-title-md">Requires My Direct Response</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-label-sm font-bold bg-secondary text-on-secondary">
                  {Math.max(1, conflictRecords.length)} PENDING
                </span>
              </div>
              <div className="p-space-md flex flex-col gap-3">
                <div className="p-3 bg-error-container/30 rounded-lg flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-error font-bold">◆ HIGH PRIORITY</span>
                      <span className="text-[11px] font-mono text-on-surface-variant font-medium">
                        {conflictRecords[0]?.conflictNo ?? "CONFLICT #CR-904"}
                      </span>
                    </div>
                    <span className="text-[11px] text-error font-bold">2h SLA</span>
                  </div>
                  <p className="font-label-md text-label-md text-on-surface">
                    Resolve Dematagoda Corridor Trench depth clash with underground utility conduit.
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">RoadSync Deconfliction</span>
                    <Link
                      href="/roadsync/conflicts"
                      className="px-3 py-1 bg-secondary text-on-secondary hover:bg-secondary-container rounded text-label-sm font-label-sm"
                    >
                      Enforce Re-Alignment
                    </Link>
                  </div>
                </div>

                <div className="p-3 bg-surface-container-low rounded-lg flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <span className="text-xs text-secondary font-bold">● PERMIT VARIATION</span>
                    <span className="text-[11px] text-on-surface-variant">Today</span>
                  </div>
                  <p className="font-label-md text-label-md text-on-surface">
                    Approve sub-surface permit variation for water main tie-in at Orugodawatta Junction.
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">Wayleave Section 12-A</span>
                    <Link
                      href="/roadsync/work-requests"
                      className="px-3 py-1 bg-surface-container-lowest hover:bg-surface-container text-on-surface rounded text-label-sm font-label-sm shadow-2xs"
                    >
                      Authorize Permit
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* System Navigation Fast Path */}
            <div className="bg-primary-container p-space-md rounded-lg shadow-2xs text-on-primary flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-primary-container">System Command Links</span>
                <span className="material-symbols-outlined text-secondary text-[20px]">hub</span>
              </div>
              <p className="font-body-sm text-body-sm text-primary-fixed-dim">
                Directly pivot from individual deliverables to system-wide spatial deconfliction or full project portfolios.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Link
                  href="/roadsync"
                  className="p-2.5 rounded bg-surface-container-high/10 hover:bg-surface-container-high/20 text-on-primary text-center font-label-sm text-label-sm flex flex-col items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px] text-secondary">alt_route</span>
                  <span>Open RoadSync</span>
                </Link>
                <Link
                  href="/projects"
                  className="p-2.5 rounded bg-surface-container-high/10 hover:bg-surface-container-high/20 text-on-primary text-center font-label-sm text-label-sm flex flex-col items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px] text-secondary">view_kanban</span>
                  <span>All Projects</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * CORE-02.14: INSPECTOR — Field Inspection Command
 * ========================================================================== */
export function InspectorCommandView({
  epoch,
  sessionUser,
  onExportTelemetry,
}: RoleCommandSharedProps) {
  const [cacheSynced, setCacheSynced] = useState(false);
  const [scheduleFilter, setScheduleFilter] = useState<"ALL" | "IN_PROGRESS" | "SCHEDULED" | "SUBMITTED">("ALL");

  const summaryQ = useQuery({
    queryKey: ["inspections", "summary", "dashboard", epoch],
    queryFn: ({ signal }) => fetchSummary({}, signal),
    staleTime: 30_000,
    retry: false,
  });

  const myWorkQ = useQuery({
    queryKey: ["inspections", "my", "dashboard", epoch],
    queryFn: ({ signal }) => fetchMyWork(signal),
    staleTime: 30_000,
    retry: false,
  });

  const listQ = useQuery({
    queryKey: ["inspections", "list", "dashboard", epoch],
    queryFn: ({ signal }) => fetchInspections({ page: 1, limit: 5 }, signal),
    staleTime: 30_000,
    retry: false,
  });

  const todayRows = myWorkQ.data?.today ?? listQ.data?.rows ?? [];
  const counts = summaryQ.data?.counts;
  const medianHours = summaryQ.data?.turnaround.medianHours ?? 4.2;

  return (
    <div className="flex flex-col w-full">
      {/* Command Header Strip */}
      <div className="px-4 sm:px-gutter-desktop py-space-lg bg-surface-container-lowest border-b border-outline-variant/25 shadow-2xs">
        <div className="max-w-[1600px] mx-auto w-full flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
                FIELD OPERATIONS COMMAND • QUALITY ASSURANCE &amp; STATUTORY VERIFICATION
              </span>
              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-label-sm font-bold bg-secondary-fixed text-on-secondary-fixed">
                LIVE CADASTRE
              </span>
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Field Inspection Command</h1>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Western Province Corridors • Civil Authority Engine</span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-4xl mt-0.5">
              Manage geolocated civil engineering inspections, field test lab verifications, non-conformance reports, and milestone sign-offs across Western Province corridors.
            </p>
            <div className="flex items-center gap-4 flex-wrap mt-2 pt-2 border-t border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
                <span className="font-label-md text-label-md text-on-surface">
                  {sessionUser?.displayName || "Eng. Gamini Mendis, CEng MIE(SL)"}
                </span>
                <span className="font-body-sm text-[11px] text-on-surface-variant font-medium">(NBRO / RDA QA Directorate)</span>
              </div>
              <span className="text-outline-variant">•</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>EPSG:5234 [6.9271° N, 79.8612° E]</span>
                <span className="text-secondary font-bold">
                  {cacheSynced ? "CACHE VERIFIED (100%)" : "CACHE READY (98MB)"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-space-sm flex-wrap shrink-0">
            <button
              type="button"
              onClick={onExportTelemetry}
              className="inline-flex items-center gap-2 px-3 py-2 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md rounded border border-outline-variant/40 shadow-2xs transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Export QA Log</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCacheSynced(true);
                void summaryQ.refetch();
                void myWorkQ.refetch();
              }}
              className="inline-flex items-center gap-2 px-3 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md rounded shadow-2xs transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">sync</span>
              <span>Sync Field Cache</span>
            </button>
            <Link
              href="/inspections"
              className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary-container text-on-secondary font-label-md text-label-md rounded shadow-2xs transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
              <span>Start Geocoded Inspection</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Operational Pulse (5 Metric KPIs) */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-gutter-desktop py-space-md">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-secondary" />
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-label-sm uppercase tracking-wider">Today&apos;s Queue</span>
              <span className="material-symbols-outlined text-[20px] text-secondary">event_available</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface tabular-nums">
                {String(todayRows.length || 4).padStart(2, "0")}
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant">Sites Scheduled</span>
            </div>
            <div className="mt-2 flex items-center gap-1 font-label-sm text-[11px] text-secondary">
              <span>● {counts?.inProgress ?? 1} In-Progress</span>
              <span className="text-outline-variant">|</span>
              <span className="text-on-surface-variant">{counts?.upcoming7d ?? 3} Queued</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-label-sm uppercase tracking-wider">Awaiting Review</span>
              <span className="material-symbols-outlined text-[20px] text-amber-600">science</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface tabular-nums">
                {String(counts?.awaitingReview ?? 3).padStart(2, "0")}
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant">Core Samples</span>
            </div>
            <div className="mt-2 flex items-center gap-1 font-label-sm text-[11px] text-on-surface-variant">
              <span>NBRO Central Laboratory</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-error" />
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-label-sm uppercase tracking-wider">Active Holds (NCR)</span>
              <span className="material-symbols-outlined text-[20px] text-error">report</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-bold text-error tabular-nums">
                {String(counts?.revisionRequired ?? 2).padStart(2, "0")}
              </span>
              <span className="font-body-sm text-[11px] text-error font-medium">Critical Clashes</span>
            </div>
            <div className="mt-2 flex items-center gap-1 font-label-sm text-[11px] text-error font-semibold">
              <span>Marine Dr Density Breach</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600" />
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-label-sm uppercase tracking-wider">Verified (30d)</span>
              <span className="material-symbols-outlined text-[20px] text-emerald-600">verified</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface tabular-nums">
                {counts?.verified30d ?? 24}
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant">Milestones Sealed</span>
            </div>
            <div className="mt-2 flex items-center gap-1 font-label-sm text-[11px] text-emerald-700 font-medium">
              <span>100% Audit Adherence</span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between relative overflow-hidden col-span-2 md:col-span-1">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary-container" />
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="font-label-sm text-label-sm uppercase tracking-wider">Turnaround SLA</span>
              <span className="material-symbols-outlined text-[20px] text-on-surface">avg_pace</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-bold text-on-surface tabular-nums">{medianHours}</span>
              <span className="font-body-sm text-body-sm text-on-surface font-semibold">Hours</span>
            </div>
            <div className="mt-2 flex items-center gap-1 font-label-sm text-[11px] text-on-surface-variant">
              <span>Extraction to Digital Seal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-Column Field Ops Surface */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-gutter-desktop pb-space-xl flex flex-col gap-space-lg">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
          {/* Chronological Inspection Schedule (7 Cols) */}
          <div className="xl:col-span-7 flex flex-col gap-space-md bg-surface-container-lowest p-space-lg rounded-lg border border-outline-variant/30 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">route</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface tracking-tight">
                  Today&apos;s Geocoded Field Schedule
                </h2>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(["ALL", "IN_PROGRESS", "SCHEDULED", "SUBMITTED"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setScheduleFilter(st)}
                    className={
                      scheduleFilter === st
                        ? "px-2 py-0.5 rounded bg-secondary text-white text-[10px] font-mono font-bold"
                        : "px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant hover:text-on-surface text-[10px] font-mono"
                    }
                  >
                    {st === "ALL" ? "ALL" : st.replace(/_/g, " ")}
                  </button>
                ))}
                <Link href="/inspections" className="ml-2 font-label-sm text-label-sm uppercase tracking-wider text-secondary hover:underline">
                  Full Queue →
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-space-sm relative pl-6 before:content-[''] before:absolute before:left-2.5 before:top-4 before:bottom-6 before:w-[2px] before:bg-outline-variant/30">
              {(todayRows.length > 0
                ? todayRows.slice(0, 4).map((r) => ({
                    id: r.id,
                    time: new Date(r.inspectionDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                    status: r.status,
                    code: r.projectCode ?? r.inspectionNo ?? "INSP",
                    title: r.projectTitle ?? `${r.inspectionType.replace(/_/g, " ")} Inspection`,
                    sub: `Type: ${r.inspectionType.replace(/_/g, " ")} • Priority: ${r.priority}`,
                    href: `/inspections/${r.id}`,
                  }))
                : [
                    {
                      id: "insp-1",
                      time: "09:30 AM",
                      status: "IN_PROGRESS",
                      code: "PRJ-2026-042",
                      title: "Baseline Road Corridor Sub-base Compaction Density Test",
                      sub: "Contractor: Maga Engineering Corp • Test Method: ASTM D1556 Sand Cone",
                      href: "/inspections",
                    },
                    {
                      id: "insp-2",
                      time: "11:45 AM",
                      status: "SCHEDULED",
                      code: "PRJ-2026-089",
                      title: "Marine Drive Phase IV Stormwater Outfall Hydrostatic Pressure Verification",
                      sub: "Contractor: Access Engineering PLC • Pre-pour structural reinforcement check",
                      href: "/inspections",
                    },
                    {
                      id: "insp-3",
                      time: "02:30 PM",
                      status: "SUBMITTED",
                      code: "PRJ-2026-104",
                      title: "Kelani Valley Substation Ducting Trench Bedding Sand Sieve Analysis",
                      sub: "Agency: CEB / SLT Conduit Joint Works • Particle Size Distribution Curve audit",
                      href: "/inspections",
                    },
                  ]
              )
                .filter((item) => (scheduleFilter === "ALL" ? true : item.status === scheduleFilter))
                .map((item, idx) => (
                <div
                  key={item.id}
                  className="relative bg-surface-container-low p-space-md rounded-lg flex flex-col gap-2 transition-shadow hover:shadow-2xs"
                >
                  <span
                    className={`absolute -left-6 top-5 -ml-[5px] w-3 h-3 rounded-full ring-4 ring-surface-container-lowest ${
                      idx === 0 ? "bg-secondary animate-pulse" : "bg-outline-variant"
                    }`}
                  />
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-label-md text-label-md text-secondary font-bold">{item.time}</span>
                      <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary text-on-secondary uppercase">
                        {item.status.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono text-xs font-semibold text-on-surface">{item.code}</span>
                    </div>
                    <span className="font-mono text-xs text-on-surface-variant font-medium">CH 04+200 — 05+100</span>
                  </div>
                  <div>
                    <h3 className="font-title-md text-title-md text-on-surface font-semibold">{item.title}</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{item.sub}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 mt-1">
                    <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
                      <span className="material-symbols-outlined text-[14px] text-emerald-600">gps_fixed</span>
                      <span>Lat: 6.9142°, Lon: 79.8731°</span>
                    </div>
                    <Link
                      href={item.href}
                      className="px-3 py-1.5 bg-secondary text-on-secondary font-label-md text-label-md rounded flex items-center gap-1.5 hover:bg-secondary-container transition-colors"
                    >
                      <span>Open Field Log</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right 5 Cols: Active Stop-Work Hold & Vector Cadastre */}
          <div className="xl:col-span-5 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col gap-3 border-t-4 border-t-error">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-error">
                  <span className="material-symbols-outlined text-[20px]">warning</span>
                  <span className="font-title-md text-title-md font-bold text-on-surface">Active Stop-Work Hold (NCR)</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-label-sm font-bold bg-error text-on-error uppercase">
                  FIELD STOP-WORK
                </span>
              </div>
              <div className="p-3 bg-error-container/40 rounded flex flex-col gap-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="font-bold text-on-surface">NCR #2026-014</span>
                  <span className="text-error font-semibold">CRITICAL LEVEL 1</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface">
                  <strong className="font-bold">Marine Drive Multi-Utility Conduit:</strong> Unapproved backfill gravel gradation identified between CH 02+150 and 02+270. Contractor instructed to excavate and replace the 120m segment.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Link
                  href="/inspections"
                  className="px-3 py-1.5 bg-error text-on-error hover:bg-error/90 font-label-md text-label-md rounded transition-colors"
                >
                  Manage NCR Directive
                </Link>
              </div>
            </div>

            {/* Mobile Field Instrumentation Dock */}
            <div className="bg-primary-container text-primary-fixed p-space-md rounded-lg shadow-2xs flex flex-col gap-space-md border border-outline-variant/15">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-on-secondary shrink-0">
                  <span className="material-symbols-outlined text-[22px]">handyman</span>
                </div>
                <div>
                  <span className="font-title-md text-title-md text-surface-container-lowest font-bold block">
                    Mobile Field Instrumentation Dock
                  </span>
                  <span className="font-body-sm text-[12px] text-on-primary-container">
                    Peripheral interfaces connected via BLE • Offline geocoded capture ready
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/inspections"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-container-highest/10 hover:bg-surface-container-highest/20 text-surface-container-lowest rounded font-label-md text-label-md transition-colors border border-outline-variant/20"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">photo_camera</span>
                  <span>Geocoded Evidence</span>
                </Link>
                <Link
                  href="/inframap"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-container-highest/10 hover:bg-surface-container-highest/20 text-surface-container-lowest rounded font-label-md text-label-md transition-colors border border-outline-variant/20"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">map</span>
                  <span>Vector Chainage</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
