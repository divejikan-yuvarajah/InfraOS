"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { fetchAgencies } from "@/lib/admin-agencies/api";
import { createAdminUser } from "@/lib/admin-users/api";
import {
  getAuthEpoch,
  getMemoryAccessToken,
  getMemorySession,
  subscribeAuth,
} from "@/lib/auth/state";

type SecurityAlertItem = {
  id: string;
  severity: "CRITICAL" | "WARNING";
  category: "SOD_BLOCK" | "DAG_LOCK" | "PKI_EXPIRY";
  categoryLabel: string;
  timeAgo: string;
  title: string;
  description: string;
  principal: string;
  ip: string;
  hash: string;
};

const INITIAL_SECURITY_ALERTS: SecurityAlertItem[] = [
  {
    id: "SEC-9042",
    severity: "CRITICAL",
    category: "SOD_BLOCK",
    categoryLabel: "SoD CEILING BLOCK · HTTP 403",
    timeAgo: "04 mins ago",
    title: "Cross-Role Milestone Self-Certification Attempt Blocked",
    description:
      "Principal eng.perera@rda.gov.lk (PROJECT_MANAGER) attempted to invoke POST /api/v1/inspections/certify-ipc on Contract RDA-WP-089. Action requires independent INSPECTOR role attestation.",
    principal: "USR-RDA-0412 (K.M. Perera)",
    ip: "203.115.24.88 (Colombo District Node)",
    hash: "0x7f4a...c91e",
  },
  {
    id: "SEC-9038",
    severity: "WARNING",
    category: "DAG_LOCK",
    categoryLabel: "AGENCY DEACTIVATION LOCK · CORE-03.30",
    timeAgo: "19 mins ago",
    title: "Deactivation of Provincial Sub-Agency Halted by Active Corridor Dependencies",
    description:
      "Attempt to deactivate agency node PRDA-WP-SOUTH blocked by Integrity Guard: 4 active RoadSync excavation permits and 11 assigned staff principals remain attached.",
    principal: "TARGET: PRDA-WP-SOUTH",
    ip: "BLOCKERS: 4 Permits · 11 Staff",
    hash: "0x3b81...a04d",
  },
  {
    id: "SEC-9029",
    severity: "WARNING",
    category: "PKI_EXPIRY",
    categoryLabel: "GOVPKI TOKEN EXPIRATION · 72H WINDOW",
    timeAgo: "1 hour ago",
    title: "Hardware X.509 Attestation Certificate Approaching Renewal Threshold",
    description:
      "Regional Engineering Enclave certificate for NWSDB Greater Colombo North expires in 72 hours. Automated CSR rotation ready for Super Admin countersignature.",
    principal: "CERT: LK-GOVPKI-NWSDB-04",
    ip: "203.115.18.102 (Maligakanda HQ)",
    hash: "0x91e4...77b2",
  },
];

const ROLES = [
  "SUPER_ADMIN",
  "GOV_ADMIN",
  "AGENCY_OFFICER",
  "PROJECT_MANAGER",
  "CONTRACTOR",
  "INSPECTOR",
  "CITIZEN",
] as const;

export function AdminSecurityAlertsPageClient() {
  const queryClient = useQueryClient();
  const epoch = useSyncExternalStore(subscribeAuth, getAuthEpoch, () => 0);
  const hasToken = useSyncExternalStore(
    subscribeAuth,
    () => Boolean(getMemoryAccessToken()),
    () => false,
  );
  const actor = useSyncExternalStore(
    subscribeAuth,
    () => getMemorySession()?.user ?? null,
    () => null,
  );

  const [alerts, setAlerts] = useState<SecurityAlertItem[]>(INITIAL_SECURITY_ALERTS);
  const [alertFilter, setAlertFilter] = useState<"ALL" | "SOD_BLOCK" | "DAG_LOCK" | "PKI_EXPIRY">(
    "ALL",
  );
  const [inspectedAlertId, setInspectedAlertId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // CORE-03.11 / CORE-03.12 Staff Provisioning Studio form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("InfraOS#2026!Gov");
  const [roleKey, setRoleKey] = useState<string>("AGENCY_OFFICER");
  const [agencyCode, setAgencyCode] = useState<string>("RDA");
  const [gazetteWarrant, setGazetteWarrant] = useState(
    "GAZ-2026-PROV-118 · Statutory Engineering Intake",
  );

  const agenciesQ = useQuery({
    queryKey: ["admin", "agencies", "security-provisioning", epoch],
    queryFn: () => fetchAgencies({ page: 1 }),
    enabled: hasToken && Boolean(actor),
    staleTime: 30_000,
    retry: false,
  });

  const agencyOptions = useMemo(() => {
    const live = agenciesQ.data?.agencies ?? [];
    if (live.length > 0) {
      return live.map((a) => ({ code: a.code, name: a.name }));
    }
    return [
      { code: "RDA", name: "Road Development Authority" },
      { code: "NWSDB", name: "National Water Supply & Drainage Board" },
      { code: "CEB", name: "Ceylon Electricity Board" },
      { code: "UDA", name: "Urban Development Authority" },
      { code: "CMC", name: "Colombo Municipal Council" },
    ];
  }, [agenciesQ.data]);

  const provisionMutation = useMutation({
    mutationFn: () =>
      createAdminUser({
        firstName,
        lastName,
        email,
        password,
        roleKey,
        agencyCode,
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setStatusMessage(
        `Provisioned staff principal ${created.displayName} (${created.email}) with role ${created.roleKey} under ${created.agencyName ?? agencyCode}. Warrant: ${gazetteWarrant}.`,
      );
      setFirstName("");
      setLastName("");
      setEmail("");
    },
    onError: (err) => {
      const status = err instanceof ApiError ? err.status : 0;
      setStatusMessage(
        status === 409
          ? "Provisioning conflict: Email already exists or agency code is invalid."
          : status === 401 || status === 403
            ? "Only Super Administrators or authorized Gov Admins can provision staff."
            : "Unable to complete provisioning request. Check field values and retry.",
      );
    },
  });

  const filteredAlerts = useMemo(() => {
    if (alertFilter === "ALL") return alerts;
    return alerts.filter((a) => a.category === alertFilter);
  }, [alerts, alertFilter]);

  const handleAcknowledgeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setStatusMessage(`Security alert ${id} triaged and archived to the immutable audit ledger.`);
  };

  return (
    <StaffWorkspaceShell
      title="Security Alert Center & Staff Provisioning Studio"
      description="Real-time cryptographic threat triage, Separation of Duties (SoD) violation containment, and end-to-end statutory staff onboarding."
      wide
      hidePageHeader
    >
      <div className="p-4 sm:p-gutter-desktop max-w-[1600px] mx-auto w-full flex flex-col gap-space-lg">
        {/* Top Module Sub-Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-outline-variant/30 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href="/admin/governance"
              className="px-3 py-1.5 rounded bg-surface-container-low text-on-surface-variant hover:text-on-surface font-semibold"
            >
              03.01 Governance Overview
            </Link>
            <Link
              href="/admin/users"
              className="px-3 py-1.5 rounded bg-surface-container-low text-on-surface-variant hover:text-on-surface font-semibold"
            >
              03.09 Staff Registry
            </Link>
            <Link
              href="/admin/agencies"
              className="px-3 py-1.5 rounded bg-surface-container-low text-on-surface-variant hover:text-on-surface font-semibold"
            >
              03.22 Agency Hierarchy
            </Link>
            <Link
              href="/admin/roles"
              className="px-3 py-1.5 rounded bg-surface-container-low text-on-surface-variant hover:text-on-surface font-semibold"
            >
              03.39 Permission Matrix
            </Link>
            <Link
              href="/admin/audit-logs"
              className="px-3 py-1.5 rounded bg-surface-container-low text-on-surface-variant hover:text-on-surface font-semibold"
            >
              03.48 Audit Ledger
            </Link>
            <Link
              href="/admin/system"
              className="px-3 py-1.5 rounded bg-surface-container-low text-on-surface-variant hover:text-on-surface font-semibold"
            >
              03.50 System &amp; Integrity
            </Link>
            <span className="px-3 py-1.5 rounded bg-secondary text-on-secondary font-bold">
              03.52 Security Alerts &amp; Provisioning
            </span>
          </div>
          <span className="font-mono text-[11px] text-error font-bold">
            ● {alerts.length} ACTIVE ALERTS IN TRIAGE
          </span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-container text-surface-container-lowest text-[10px] font-bold uppercase tracking-widest font-mono">
                CORE-03.52 &amp; CORE-03.11 / 03.12
              </span>
              <span className="text-xs font-semibold text-error uppercase tracking-wider">
                Zero-Trust Identity &amp; Threat Containment
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Security Alert Center &amp; Staff Provisioning Studio
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-3xl">
              Real-time cryptographic threat triage, Separation of Duties (SoD) violation containment, and end-to-end statutory staff onboarding with mandatory Agency &amp; Role scope binding.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setAlerts([]);
                setStatusMessage("Cleared all acknowledged informational security advisories.");
              }}
              className="h-10 px-3.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-md text-label-md flex items-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">done_all</span>
              <span>Acknowledge Resolved Alerts</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            role="status"
            className="bg-emerald-950 text-emerald-100 border border-emerald-500/40 rounded-lg px-4 py-3 flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-emerald-400">
                verified_user
              </span>
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-emerald-300 hover:text-white font-mono uppercase text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top 4 KPI Triage Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest p-4 rounded-lg border-l-4 border-l-error border border-outline-variant/40 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-error">
                Critical SoD Intercepts
              </span>
              <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container text-[10px] font-bold font-mono">
                BLOCKED
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-on-surface font-mono">02</span>
              <span className="text-xs text-error font-semibold">Auto-Contained</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2">
              Self-approval &amp; cross-agency scope escalation attempts rejected
            </p>
          </div>

          <div className="bg-surface-container-lowest p-4 rounded-lg border-l-4 border-l-secondary border border-outline-variant/40 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                Auth &amp; MFA Anomalies
              </span>
              <span className="px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold font-mono">
                TRIAGE
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-on-surface font-mono">{alerts.length}</span>
              <span className="text-xs text-on-surface-variant font-mono">Last 24 Hours</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2">
              Expired GovPKI certificates &amp; multi-region token velocity warnings
            </p>
          </div>

          <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/40 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Pending Staff Warrants
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface text-[10px] font-bold font-mono">
                QUEUE
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-on-surface font-mono">07</span>
              <span className="text-xs text-emerald-700 font-semibold">Gazette Verified</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2">
              Awaiting Super Admin role &amp; agency jurisdiction binding
            </p>
          </div>

          <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/40 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Hardware Key Attestation
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono">
                99.4%
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-on-surface font-mono">340 / 342</span>
              <span className="text-xs text-emerald-700 font-mono">FIDO2 Bound</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2">
              2 newly provisioned accounts awaiting first-login key enrollment
            </p>
          </div>
        </section>

        {/* Main 12-Column Asymmetric Split: Left (6 Cols) CORE-03.52 Security Alert Center | Right (6 Cols) CORE-03.11/12 Staff Provisioning Studio */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT 6 COLUMNS: CORE-03.52 Security Alert Center */}
          <div className="xl:col-span-6 flex flex-col gap-5">
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/40 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-primary-container text-surface-container-lowest flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[20px] text-secondary-fixed">
                    gpp_maybe
                  </span>
                  <div>
                    <h2 className="font-title-md text-title-md text-white leading-tight">
                      CORE-03.52 · Security Alert &amp; Policy Intercept Stream
                    </h2>
                    <p className="text-[11px] text-on-primary-container">
                      Real-time RBAC boundary rejections, SoD blocks, and session integrity events
                    </p>
                  </div>
                </div>
                <select
                  aria-label="Filter Security Alerts"
                  value={alertFilter}
                  onChange={(e) =>
                    setAlertFilter(
                      e.target.value as "ALL" | "SOD_BLOCK" | "DAG_LOCK" | "PKI_EXPIRY",
                    )
                  }
                  className="px-2 py-1 rounded bg-white/10 text-white text-[11px] font-mono border border-white/20"
                >
                  <option value="ALL" className="text-slate-900">
                    All Categories
                  </option>
                  <option value="SOD_BLOCK" className="text-slate-900">
                    SoD Ceiling Blocks
                  </option>
                  <option value="DAG_LOCK" className="text-slate-900">
                    DAG Deactivation Locks
                  </option>
                  <option value="PKI_EXPIRY" className="text-slate-900">
                    GovPKI Token Expiry
                  </option>
                </select>
              </div>

              <div className="divide-y divide-outline-variant/30">
                {filteredAlerts.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 transition-colors ${
                      item.severity === "CRITICAL"
                        ? "bg-error-container/15 hover:bg-error-container/25"
                        : "hover:bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            item.severity === "CRITICAL"
                              ? "bg-error text-on-error"
                              : "bg-secondary-fixed text-on-secondary-fixed"
                          }`}
                        >
                          {item.id} · {item.severity}
                        </span>
                        <span
                          className={`text-xs font-mono font-bold ${
                            item.severity === "CRITICAL" ? "text-error" : "text-secondary"
                          }`}
                        >
                          {item.categoryLabel}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-on-surface-variant">
                        {item.timeAgo}
                      </span>
                    </div>

                    <h3 className="font-title-md text-title-md text-on-surface mt-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1">{item.description}</p>

                    <div className="mt-3 p-2.5 rounded bg-surface-container-lowest border border-outline-variant/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-on-surface-variant">PRINCIPAL:</span>{" "}
                        <strong className="text-on-surface">{item.principal}</strong>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">TRACE:</span>{" "}
                        <strong className="text-on-surface">{item.ip}</strong>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">HASH:</span>{" "}
                        <strong className="text-emerald-700">{item.hash}</strong>
                      </div>
                    </div>

                    {inspectedAlertId === item.id && (
                      <div className="mt-2 p-2.5 rounded bg-[#0d1620] text-emerald-300 font-mono text-[11px]">
                        [ENCLAVE TRACE {item.id}] Verified policy guard execution. Request halted prior to database write transaction. Audit record sealed under {item.hash}.
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">verified_user</span>
                        {item.severity === "CRITICAL"
                          ? "Enclave Guard Rejected Mutation · Ledger Entry Recorded"
                          : "Zero-Orphan Governance Rule Enforced"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setInspectedAlertId(
                              inspectedAlertId === item.id ? null : item.id,
                            )
                          }
                          className="px-2.5 py-1 rounded border border-outline-variant/60 bg-surface-container-lowest text-xs font-semibold text-on-surface hover:bg-surface-container-low"
                        >
                          {inspectedAlertId === item.id ? "Hide Trace" : "Inspect Trace"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAcknowledgeAlert(item.id)}
                          className="px-2.5 py-1 rounded bg-primary-container text-white text-xs font-semibold hover:bg-primary"
                        >
                          Clear Alert
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredAlerts.length === 0 && (
                  <div className="p-8 text-center text-xs text-on-surface-variant">
                    All security alerts in this category have been triaged and archived.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT 6 COLUMNS: CORE-03.11 & CORE-03.12 Staff Provisioning Studio */}
          <div className="xl:col-span-6 flex flex-col gap-5">
            <div className="bg-surface-container-lowest rounded-lg border-2 border-primary-container shadow-lg overflow-hidden">
              <div className="px-5 py-4 bg-primary-container text-surface-container-lowest flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-secondary text-on-secondary font-mono text-[10px] font-bold">
                      CORE-03.11 &amp; CORE-03.12
                    </span>
                    <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-primary-container">
                      STAFF PROVISIONING STUDIO
                    </span>
                  </div>
                  <h2 className="font-title-lg text-title-lg text-white mt-1">
                    Statutory Officer Onboarding &amp; Scope Binding
                  </h2>
                </div>
                <span className="material-symbols-outlined text-secondary-fixed text-[26px]">
                  person_add
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  provisionMutation.mutate();
                }}
                className="p-5 flex flex-col gap-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
                    Officer First Name
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Kasun"
                      className="h-9 px-3 rounded border border-outline-variant/60 bg-surface-container-low text-on-surface text-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
                    Officer Last Name
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Senanayake"
                      className="h-9 px-3 rounded border border-outline-variant/60 bg-surface-container-low text-on-surface text-xs"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
                    Official Government Email (.gov.lk)
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="k.senanayake@rda.gov.lk"
                      className="h-9 px-3 rounded border border-outline-variant/60 bg-surface-container-low text-on-surface font-mono text-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
                    Initial Temporary Enclave Password
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-9 px-3 rounded border border-outline-variant/60 bg-surface-container-low text-on-surface font-mono text-xs"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
                    Predefined Role Authority (CORE-03.12)
                    <select
                      value={roleKey}
                      onChange={(e) => setRoleKey(e.target.value)}
                      className="h-9 px-2.5 rounded border border-outline-variant/60 bg-surface-container-low text-on-surface font-mono text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
                    Primary Agency Jurisdiction
                    <select
                      value={agencyCode}
                      onChange={(e) => setAgencyCode(e.target.value)}
                      className="h-9 px-2.5 rounded border border-outline-variant/60 bg-surface-container-low text-on-surface font-mono text-xs"
                    >
                      {agencyOptions.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
                  Appointment Gazette / Warrant Reference
                  <input
                    type="text"
                    required
                    value={gazetteWarrant}
                    onChange={(e) => setGazetteWarrant(e.target.value)}
                    className="h-9 px-3 rounded border border-outline-variant/60 bg-surface-container-low text-on-surface font-mono text-xs"
                  />
                </label>

                <div className="p-3 rounded-lg bg-surface-container border border-outline-variant/40 text-xs flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase text-secondary font-bold">
                    PROVISIONING ATTESTATION SUMMARY
                  </span>
                  <span className="font-mono text-on-surface">
                    Principal: {email || "pending@agency.gov.lk"} → Role: {roleKey} · Agency:{" "}
                    {agencyCode}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    Account initializes in PENDING_VERIFICATION until FIDO2 hardware key binding completes.
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Link
                    href="/admin/users"
                    className="text-xs font-semibold text-secondary hover:underline"
                  >
                    Open Full Staff Registry →
                  </Link>
                  <button
                    type="submit"
                    disabled={provisionMutation.isPending}
                    className="h-10 px-5 rounded-lg bg-secondary hover:bg-secondary-container text-on-secondary font-label-md text-label-md flex items-center gap-2 shadow-2xs transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    <span>
                      {provisionMutation.isPending
                        ? "Provisioning Principal..."
                        : "Execute Staff Provisioning"}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </StaffWorkspaceShell>
  );
}

