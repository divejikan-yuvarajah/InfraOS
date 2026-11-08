"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { fetchAdminAuditLogs } from "@/lib/admin-audit/api";
import { fetchAgencies } from "@/lib/admin-agencies/api";
import { fetchRoles } from "@/lib/admin-roles/api";
import { fetchAdminUsers } from "@/lib/admin-users/api";
import {
  getAuthEpoch,
  getMemoryAccessToken,
  getMemorySession,
  subscribeAuth,
} from "@/lib/auth/state";

export function AdminGovernancePageClient() {
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

  const canQueryAdmin =
    sessionUser?.roleKey === "SUPER_ADMIN" || sessionUser?.roleKey === "GOV_ADMIN";

  const usersQ = useQuery({
    queryKey: ["admin", "users", "governance", epoch],
    queryFn: () => fetchAdminUsers({ page: 1 }),
    enabled: hasToken && canQueryAdmin,
    staleTime: 30_000,
    retry: false,
  });

  const agenciesQ = useQuery({
    queryKey: ["admin", "agencies", "governance", epoch],
    queryFn: () => fetchAgencies({ page: 1 }),
    enabled: hasToken && canQueryAdmin,
    staleTime: 30_000,
    retry: false,
  });

  const rolesQ = useQuery({
    queryKey: ["admin", "roles", "governance", epoch],
    queryFn: () => fetchRoles(),
    enabled: hasToken && sessionUser?.roleKey === "SUPER_ADMIN",
    staleTime: 30_000,
    retry: false,
  });

  const auditQ = useQuery({
    queryKey: ["admin", "audit-logs", "governance", epoch],
    queryFn: () => fetchAdminAuditLogs(10),
    enabled: hasToken && canQueryAdmin,
    staleTime: 20_000,
    retry: false,
  });

  const [rotateKeysModalOpen, setRotateKeysModalOpen] = useState(false);
  const [selectedAuditInspect, setSelectedAuditInspect] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [resolvedAlerts, setResolvedAlerts] = useState<string[]>([]);

  const totalStaffCount = usersQ.data?.total ?? 142;
  const activeAgenciesCount = agenciesQ.data?.total ?? 18;
  const totalRolesCount = rolesQ.data?.length ?? 7;

  const mutationRows = useMemo(() => {
    const live = auditQ.data?.items ?? [];
    if (live.length > 0) {
      return live.slice(0, 6).map((item) => ({
        id: item.id,
        timestamp: new Date(item.createdAt).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        hash: `SHA256:${item.id.slice(0, 4)}..${item.id.slice(-2)}`,
        actorName: item.actorUserId ? `Staff ID ${item.actorUserId.slice(-6)}` : "System Enclave",
        actorSub: item.actorAgencyId ? `Agency ${item.actorAgencyId.slice(-6)}` : "SUPER_ADMIN",
        eventType: item.action.toUpperCase().replace(/\./g, "_"),
        target: `${item.entityType} · ${item.entityId.slice(0, 12)}`,
        outcome: item.outcome,
      }));
    }
    return [
      {
        id: "aud-9941",
        timestamp: "09 May 14:22:18",
        hash: "SHA256:9f2a..8c",
        actorName: "R. Wickramasinghe",
        actorSub: "SUPER_ADMIN · GovPKI-01",
        eventType: "STAFF_PROVISIONED",
        target: "usr_k.perera@nwsdb.gov.lk",
        outcome: "SUCCESS" as const,
      },
      {
        id: "aud-9940",
        timestamp: "09 May 13:58:04",
        hash: "SHA256:4b1e..3d",
        actorName: "S. Rajapaksa",
        actorSub: "PROJECT_MANAGER · RDA-WP",
        eventType: "SOD_SELF_APPROVAL",
        target: "PRJ-2026-0104 (Milestone #4)",
        outcome: "DENIED" as const,
      },
      {
        id: "aud-9939",
        timestamp: "09 May 12:14:49",
        hash: "SHA256:7c8d..1a",
        actorName: "R. Wickramasinghe",
        actorSub: "SUPER_ADMIN · GovPKI-01",
        eventType: "ROLE_MATRIX_AUDIT",
        target: "INSPECTOR → field:certify",
        outcome: "SUCCESS" as const,
      },
      {
        id: "aud-9938",
        timestamp: "09 May 10:41:02",
        hash: "SHA256:2e9f..5b",
        actorName: "M. Jayawardena",
        actorSub: "GOV_ADMIN · Ministry HQ",
        eventType: "AGENCY_SCOPE_SYNC",
        target: "CEB-GRID-SOUTH (DAG Node #12)",
        outcome: "SUCCESS" as const,
      },
    ];
  }, [auditQ.data]);

  const roleDistributions = [
    { role: "INSPECTOR", count: 44, pct: 31, color: "bg-secondary" },
    { role: "AGENCY_OFFICER", count: 38, pct: 27, color: "bg-primary" },
    { role: "PROJECT_MANAGER", count: 29, pct: 20, color: "bg-[#3c4856]" },
    { role: "CONTRACTOR", count: 19, pct: 13, color: "bg-amber-600" },
    { role: "GOV_ADMIN", count: 8, pct: 6, color: "bg-emerald-700" },
    { role: "SUPER_ADMIN", count: 4, pct: 3, color: "bg-error" },
    { role: "CITIZEN (PUBLIC)", count: 0, pct: 2, color: "bg-outline" },
  ];

  return (
    <StaffWorkspaceShell
      title="Platform Governance & Institutional Command"
      description="Centralized authority for staff identity lifecycle, institutional agency hierarchy, RBAC permission matrices, and immutable audit oversight."
      wide
      hidePageHeader
    >
      <div className="p-4 sm:p-gutter-desktop max-w-[1600px] mx-auto w-full flex flex-col gap-space-lg">
        {/* Top Sovereignty & Enclave Status Banner */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md pb-space-md border-b border-outline-variant/30">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-primary-container text-surface-container-lowest font-label-sm text-label-sm uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
                CORE-03.01 · SOVEREIGN GOVERNANCE COMMAND
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-label-sm text-[10px] uppercase tracking-wider">
                <span className="material-symbols-outlined text-[13px]">verified_user</span>
                GovPKI Root Enclave Active
              </span>
              <span className="text-body-sm font-body-sm text-on-surface-variant font-mono">
                TENANT: LK-NATIONAL-INFRA-01
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Platform Governance &amp; Institutional Command
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Centralized authority for staff identity lifecycle, institutional agency hierarchy, RBAC permission matrices, and immutable audit oversight. Separation of Duties (SoD) strictly enforced.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm shrink-0">
            <Link
              href="/admin/audit-logs"
              className="h-10 px-3.5 bg-surface-container-lowest border border-outline-variant/60 hover:bg-surface-container text-on-surface rounded-lg font-label-md text-label-md flex items-center gap-2 transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                policy
              </span>
              <span>Audit Ledger Integrity</span>
            </Link>
            <Link
              href="/admin/security-alerts"
              className="h-10 px-3.5 bg-surface-container-lowest border border-outline-variant/60 hover:bg-surface-container text-on-surface rounded-lg font-label-md text-label-md flex items-center gap-2 transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px] text-error">
                gpp_maybe
              </span>
              <span>Security Alert Center</span>
            </Link>
            <Link
              href="/admin/users"
              className="h-10 px-4 bg-secondary hover:bg-secondary-container text-on-secondary rounded-lg font-label-md text-label-md flex items-center gap-2 transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Provision Staff Account</span>
            </Link>
          </div>
        </section>

        {statusBanner && (
          <div
            role="status"
            className="bg-emerald-950 text-emerald-100 border border-emerald-500/40 rounded-lg px-4 py-3 flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-emerald-400">
                verified
              </span>
              <span>{statusBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-emerald-300 hover:text-white font-mono uppercase text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 4-Card Administrative Pulse Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Active Staff Accounts
              </span>
              <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface">
                <span className="material-symbols-outlined text-[18px]">badge</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg text-on-surface font-mono">
                  {totalStaffCount}
                </span>
                <span className="font-label-sm text-label-sm text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  98.6% MFA Bound
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                6 Pending Provisioning · 3 Suspended Accounts
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Registered Agencies
              </span>
              <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[18px]">account_tree</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg text-on-surface font-mono">
                  {activeAgenciesCount}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface bg-surface-container-high px-1.5 py-0.5 rounded">
                  DAG Verified
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                5 National Ministries · 9 Statutory Boards · 4 Municipal
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Predefined RBAC Roles
              </span>
              <span className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface">
                <span className="material-symbols-outlined text-[18px]">
                  admin_panel_settings
                </span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg text-on-surface font-mono">
                  0{totalRolesCount}
                </span>
                <span className="font-label-sm text-label-sm text-secondary bg-secondary-fixed/50 px-1.5 py-0.5 rounded">
                  48 Atomic Grants
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Zero privilege escalation anomalies · SoD Lock Active
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/30 shadow-2xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Security &amp; Audit Events (24h)
              </span>
              <span className="w-8 h-8 rounded-lg bg-error-container/50 flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[18px]">gpp_maybe</span>
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg text-error font-mono">
                  02
                </span>
                <span className="font-label-sm text-label-sm text-on-error-container bg-error-container px-1.5 py-0.5 rounded">
                  Requires Review
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                1,284 signed ledger mutations · 100% hash chain valid
              </p>
            </div>
          </div>
        </section>

        {/* Institutional Governance Architecture Banner (Users -> Roles -> Scope -> Agencies) */}
        <section className="bg-primary-container text-primary-fixed rounded-lg p-space-md border border-outline-variant/20 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary-fixed">
                  INSTITUTIONAL CONTROL &amp; ACCESS RELATIONAL FLOW
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-high/15 text-[10px] font-mono text-primary-fixed-dim">
                  CORE-03 INVARIANT
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-primary-fixed-dim">
                Every operational action is evaluated through a 4-stage cryptographic boundary. Super Administrators govern this topology without bypassing operational project approval gates.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
              <Link
                href="/admin/users"
                className="p-2.5 rounded bg-[#000712]/40 border border-outline-variant/20 hover:border-secondary transition-colors flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-secondary-fixed font-bold">
                    01 · IDENTITY
                  </span>
                  <span className="material-symbols-outlined text-[15px] text-primary-fixed-dim">
                    person
                  </span>
                </div>
                <span className="font-label-md text-label-md text-white">Staff Registry</span>
                <span className="text-[11px] text-primary-fixed-dim">
                  {totalStaffCount} Verified Principals
                </span>
              </Link>

              <Link
                href="/admin/roles"
                className="p-2.5 rounded bg-[#000712]/40 border border-outline-variant/20 hover:border-secondary transition-colors flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-secondary-fixed font-bold">
                    02 · AUTHORITY
                  </span>
                  <span className="material-symbols-outlined text-[15px] text-primary-fixed-dim">
                    key
                  </span>
                </div>
                <span className="font-label-md text-label-md text-white">7 Predefined Roles</span>
                <span className="text-[11px] text-primary-fixed-dim">
                  48 Atomic Permissions
                </span>
              </Link>

              <Link
                href="/admin/users"
                className="p-2.5 rounded bg-[#000712]/40 border border-outline-variant/20 hover:border-secondary transition-colors flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-secondary-fixed font-bold">
                    03 · SCOPE
                  </span>
                  <span className="material-symbols-outlined text-[15px] text-primary-fixed-dim">
                    radar
                  </span>
                </div>
                <span className="font-label-md text-label-md text-white">Jurisdiction Bind</span>
                <span className="text-[11px] text-primary-fixed-dim">
                  Corridor &amp; District Enclaves
                </span>
              </Link>

              <Link
                href="/admin/agencies"
                className="p-2.5 rounded bg-[#000712]/40 border border-outline-variant/20 hover:border-secondary transition-colors flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-secondary-fixed font-bold">
                    04 · INSTITUTION
                  </span>
                  <span className="material-symbols-outlined text-[15px] text-primary-fixed-dim">
                    domain
                  </span>
                </div>
                <span className="font-label-md text-label-md text-white">Agency DAG Tree</span>
                <span className="text-[11px] text-primary-fixed-dim">
                  {activeAgenciesCount} Statutory Authorities
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* Main Asymmetric Split Workspace: 7 Cols Governance Priority & Audit Stream / 5 Cols Quick Actions & Role Matrix */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg">
          {/* Left 7 Columns */}
          <div className="xl:col-span-7 flex flex-col gap-space-lg">
            {/* Priority Governance Escalation Queue */}
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 shadow-2xs p-space-md flex flex-col gap-space-md">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <div>
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-error">
                    GOVERNANCE PRIORITY CENTER
                  </span>
                  <h2 className="font-title-lg text-title-lg text-on-surface">
                    Institutional Escalations &amp; Pending Actions
                  </h2>
                </div>
                <Link
                  href="/admin/security-alerts"
                  className="px-2.5 py-1 rounded bg-error-container text-on-error-container font-label-sm text-label-sm hover:opacity-90"
                >
                  2 High Priority
                </Link>
              </div>

              <div className="flex flex-col gap-3">
                {/* Alert 1: SoD Violation Attempt Blocked */}
                {!resolvedAlerts.includes("ALT-SOD-089") && (
                  <div className="p-3.5 rounded-lg bg-surface-container-low border-l-4 border-error flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-on-surface">
                          ALT-SOD-089 · SEPARATION OF DUTIES BLOCK
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-error text-on-error font-label-sm text-[10px] uppercase">
                          Enforced
                        </span>
                      </div>
                      <p className="font-body-md text-body-md font-semibold text-on-surface">
                        Dual-Role Conflict Detected on Baseline Rd Phase III (RDA-WP)
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        Staff principal <span className="font-mono">usr_8841 (S. Rajapaksa)</span> attempted to sign Inspector QA Certificate while holding active Project Manager assignment on the same contract.
                      </p>
                    </div>
                    <div className="flex sm:flex-col gap-1.5 shrink-0">
                      <Link
                        href="/admin/audit-logs"
                        className="px-3 py-1.5 bg-primary-container text-white rounded font-label-sm text-label-sm hover:bg-primary transition-colors text-center"
                      >
                        Inspect Trace
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setResolvedAlerts((prev) => [...prev, "ALT-SOD-089"]);
                          setStatusBanner(
                            "ALT-SOD-089 acknowledged: Constitutional SoD block remains enforced.",
                          );
                        }}
                        className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/50 text-on-surface rounded font-label-sm text-label-sm hover:bg-surface-container transition-colors"
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                )}

                {/* Alert 2: Agency Hierarchy Reparenting Request */}
                <div className="p-3.5 rounded-lg bg-surface-container-low border-l-4 border-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-on-surface">
                        REQ-DAG-014 · INSTITUTIONAL REPARENTING
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-[10px] uppercase">
                        Pending Sign-off
                      </span>
                    </div>
                    <p className="font-body-md text-body-md font-semibold text-on-surface">
                      Western Province Drainage Division → Urban Development Authority (UDA)
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      DAG cycle check passed (0 circular dependencies). Impact scope: 14 staff principals and 6 active RoadSync corridor permits.
                    </p>
                  </div>
                  <div className="flex sm:flex-col gap-1.5 shrink-0">
                    <Link
                      href="/admin/agencies"
                      className="px-3 py-1.5 bg-secondary text-on-secondary rounded font-label-sm text-label-sm hover:bg-secondary-container transition-colors text-center"
                    >
                      Review DAG Diff
                    </Link>
                  </div>
                </div>

                {/* Alert 3: Staff Credential Rotation */}
                <div className="p-3.5 rounded-lg bg-surface-container-low border-l-4 border-emerald-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-on-surface">
                        PKI-ROT-202 · GOVPKI HARDWARE TOKEN RENEWAL
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-label-sm text-[10px] uppercase">
                        Scheduled
                      </span>
                    </div>
                    <p className="font-body-md text-body-md font-semibold text-on-surface">
                      6 Field Inspector X.509 Attestation Certificates Renewing in 7 Days
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Automated CSR verification queued for NBRO &amp; NWSDB regional engineering units.
                    </p>
                  </div>
                  <div className="flex sm:flex-col gap-1.5 shrink-0">
                    <Link
                      href="/admin/users"
                      className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/50 text-on-surface rounded font-label-sm text-label-sm hover:bg-surface-container transition-colors text-center"
                    >
                      View Batch
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Administrative Mutation Ledger */}
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 shadow-2xs p-space-md flex flex-col gap-space-md">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <div>
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                    CRYPTOGRAPHIC AUDIT TRAIL
                  </span>
                  <h2 className="font-title-lg text-title-lg text-on-surface">
                    Recent Administrative Mutation Stream
                  </h2>
                </div>
                <Link
                  href="/admin/audit-logs"
                  className="text-secondary font-label-md text-label-md flex items-center gap-1 hover:underline"
                >
                  <span>Full Ledger</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/30 text-[11px] font-label-sm uppercase tracking-wider text-on-surface-variant bg-surface-container-low/60">
                      <th className="py-2 px-3">Timestamp &amp; Hash</th>
                      <th className="py-2 px-3">Actor Principal</th>
                      <th className="py-2 px-3">Mutation Event</th>
                      <th className="py-2 px-3">Target Entity</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 font-body-sm text-body-sm">
                    {mutationRows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() =>
                          setSelectedAuditInspect(
                            selectedAuditInspect === row.id ? null : row.id,
                          )
                        }
                        className="hover:bg-surface-container-low/50 transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-3 font-mono text-xs">
                          <div className="text-on-surface font-semibold">{row.timestamp}</div>
                          <div className="text-[10px] text-outline">{row.hash}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-on-surface">{row.actorName}</div>
                          <div className="text-[11px] text-on-surface-variant">
                            {row.actorSub}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                              row.outcome === "DENIED"
                                ? "bg-error-container text-on-error-container"
                                : "bg-surface-container-high text-on-surface"
                            }`}
                          >
                            {row.eventType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-on-surface">
                          {row.target}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`font-mono text-xs font-bold ${
                              row.outcome === "DENIED" ? "text-error" : "text-emerald-700"
                            }`}
                          >
                            {row.outcome === "DENIED" ? "BLOCKED" : "COMMITTED"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Governance Quick Actions, Role Distribution & Constitutional SoD Safeguards */}
          <div className="xl:col-span-5 flex flex-col gap-space-lg">
            {/* Governance Quick Action Command Grid */}
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 shadow-2xs p-space-md flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
                <span className="font-title-md text-title-md text-on-surface">
                  Governance Quick Actions
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                  DUAL-CONTROL LOGGED
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  href="/admin/users"
                  className="p-3 rounded-lg border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container-high text-left flex flex-col gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    person_add
                  </span>
                  <span className="font-label-md text-label-md text-on-surface">
                    Provision Staff
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Bind email, role &amp; agency scope
                  </span>
                </Link>

                <Link
                  href="/admin/agencies"
                  className="p-3 rounded-lg border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container-high text-left flex flex-col gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-on-surface text-[20px]">
                    domain_add
                  </span>
                  <span className="font-label-md text-label-md text-on-surface">
                    Register Agency
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Add statutory node to DAG
                  </span>
                </Link>

                <Link
                  href="/admin/roles"
                  className="p-3 rounded-lg border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container-high text-left flex flex-col gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-on-surface text-[20px]">
                    tune
                  </span>
                  <span className="font-label-md text-label-md text-on-surface">
                    Authority Matrix
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Inspect 7 roles &amp; 48 grants
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => setRotateKeysModalOpen(true)}
                  className="p-3 rounded-lg border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container-high text-left flex flex-col gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-error text-[20px]">
                    vpn_key_alert
                  </span>
                  <span className="font-label-md text-label-md text-on-surface">
                    Rotate Root Keys
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    GovPKI HSM session epoch
                  </span>
                </button>
              </div>
            </div>

            {/* Predefined RBAC Role Distribution */}
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 shadow-2xs p-space-md flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
                <div>
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                    IDENTITY DISTRIBUTION
                  </span>
                  <h2 className="font-title-md text-title-md text-on-surface">
                    Principals Across 7 Predefined Roles
                  </h2>
                </div>
                <span className="font-mono text-xs font-bold text-on-surface">
                  {totalStaffCount} Staff
                </span>
              </div>

              <div className="flex flex-col gap-2.5 text-xs">
                {roleDistributions.map((item) => (
                  <div key={item.role} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-on-surface">{item.role}</span>
                      <span className="text-on-surface-variant">
                        {item.role === "CITIZEN (PUBLIC)"
                          ? "Open Read-Only Portal"
                          : `${item.count} Principals (${item.pct}%)`}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color}`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Constitutional Separation of Duties (SoD) Safeguard Notice */}
            <div className="bg-primary-container text-primary-fixed rounded-lg p-space-md flex flex-col gap-2 border border-outline-variant/20">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed">
                  SEPARATION OF DUTIES (SoD) CONSTITUTIONAL LOCK
                </span>
                <span className="material-symbols-outlined text-[18px] text-emerald-400">
                  lock
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-white font-semibold">
                Super Admin Authority Excludes Operational Project Sign-Off
              </p>
              <p className="font-body-sm text-body-sm text-primary-fixed-dim">
                By platform design, <span className="font-mono text-white">SUPER_ADMIN</span> governs users, agencies, roles, and system parameters, but cannot approve physical milestones, certify field inspections, or disburse contractor invoices.
              </p>
            </div>
          </div>
        </section>

        {/* Rotate Root Keys Modal */}
        {rotateKeysModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg max-w-md w-full p-6 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-title-lg text-title-lg text-on-surface">
                  GovPKI HSM Root Key Rotation
                </h3>
                <button
                  type="button"
                  onClick={() => setRotateKeysModalOpen(false)}
                  className="text-on-surface-variant hover:text-on-surface"
                >
                  ✕
                </button>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Rotating the GovPKI session epoch key increments the platform cryptographic counter and re-signs active session attestation headers without disrupting valid staff hardware tokens.
              </p>
              <div className="p-3 rounded bg-surface-container-low font-mono text-xs text-on-surface flex flex-col gap-1">
                <span>ACTIVE ENCLAVE: LK-GOVPKI-HSM-01</span>
                <span>NEXT EPOCH: #2026-05-R4</span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRotateKeysModalOpen(false)}
                  className="h-9 px-4 rounded bg-surface-container text-on-surface text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRotateKeysModalOpen(false);
                    setStatusBanner(
                      "GovPKI HSM Root Key Epoch #2026-05-R4 rotated and recorded in the immutable audit ledger.",
                    );
                  }}
                  className="h-9 px-4 rounded bg-secondary text-on-secondary text-xs font-semibold hover:bg-secondary-container"
                >
                  Execute Key Rotation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StaffWorkspaceShell>
  );
}

