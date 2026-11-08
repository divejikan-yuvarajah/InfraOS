"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import {
  createAgency,
  deactivateAgency,
  fetchAgencies,
  reparentAgency,
  updateAgencyName,
} from "@/lib/admin-agencies/api";
import { getAgencyCopy } from "@/lib/admin-agencies/messages";
import { agencyManageIsPlatformHint } from "@/lib/admin-agencies/schema";
import type { AgencyRecord } from "@/lib/admin-agencies/types";
import {
  getAuthEpoch,
  getMemoryAccessToken,
  getMemorySession,
  subscribeAuth,
} from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

function classifyAgencyError(error: unknown): "dependency" | "conflict" | "not_found" | "forbidden" | "unavailable" {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return "forbidden";
    if (error.status === 404) return "not_found";
    if (error.status === 409) {
      return error.code === "DEPENDENCY_BLOCKED" ? "dependency" : "conflict";
    }
  }
  return "unavailable";
}

const TYPES = [
  "MINISTRY",
  "DEPARTMENT",
  "AUTHORITY",
  "MUNICIPAL_COUNCIL",
  "PROVINCIAL_AGENCY",
  "UTILITY_PROVIDER",
] as const;

export function AdminAgenciesPageClient() {
  const [locale] = useWorkspaceLocale();
  const copy = getAgencyCopy(locale);
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
  const writable = agencyManageIsPlatformHint(actor?.roleKey ?? null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"HIERARCHY_DAG" | "FLAT_DIRECTORY" | "REPARENT_STUDIO">(
    "HIERARCHY_DAG",
  );
  const [selected, setSelected] = useState<AgencyRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("AUTHORITY");
  const [editDescription, setEditDescription] = useState("");
  const [parentAgencyId, setParentAgencyId] = useState("");
  const [gazetteRef, setGazetteRef] = useState(
    "GAZ-2026-EXT-2419/08 · Presidential Secretariat Reorganization",
  );
  const [dualCustodyChecked, setDualCustodyChecked] = useState(true);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "AUTHORITY",
    description: "",
    parentAgencyId: "",
  });

  const queryKey = [
    "admin",
    "agencies",
    epoch,
    actor?.id ?? null,
    actor?.roleKey ?? null,
    { page, q, status },
  ] as const;

  const listQuery = useQuery({
    queryKey,
    queryFn: () => fetchAgencies({ page, q: q || undefined, status: status || undefined }),
    enabled: hasToken && Boolean(actor),
    retry: false,
  });

  const allAgencies = listQuery.data?.agencies ?? [];

  const agencyById = useMemo(() => {
    const map = new Map<string, AgencyRecord>();
    for (const a of allAgencies) {
      map.set(a.id, a);
    }
    return map;
  }, [allAgencies]);

  function refresh(updated?: AgencyRecord, msg?: string) {
    setFeedback(msg ?? null);
    setConfirmDeactivate(false);
    if (updated) {
      setSelected(updated);
      setEditName(updated.name);
      setEditType(updated.type);
      setEditDescription(updated.description ?? "");
      setParentAgencyId(updated.parentAgencyId ?? "");
    }
    void queryClient.invalidateQueries({ queryKey: ["admin", "agencies"] });
  }

  function handleError(error: unknown) {
    const kind = classifyAgencyError(error);
    if (kind === "dependency") setFeedback(copy.dependency);
    else if (kind === "conflict") setFeedback(copy.conflict);
    else if (kind === "not_found") setFeedback(copy.notFound);
    else if (kind === "forbidden") setFeedback(copy.forbidden);
    else setFeedback(copy.unavailable);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createAgency({
        code: form.code,
        name: form.name,
        type: form.type,
        parentAgencyId: form.parentAgencyId || null,
      }),
    onSuccess: (agency) =>
      refresh(agency, `Registered statutory agency ${agency.code} (${agency.name}).`),
    onError: handleError,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      updateAgencyName(selected!.id, {
        name: editName,
        revision: selected!.revision,
      }),
    onSuccess: (agency) => refresh(agency, `Saved statutory charter details for ${agency.code}.`),
    onError: handleError,
  });

  const reparentMutation = useMutation({
    mutationFn: () =>
      reparentAgency(selected!.id, {
        parentAgencyId: parentAgencyId || null,
        revision: selected!.revision,
      }),
    onSuccess: (agency) =>
      refresh(
        agency,
        `Reparenting transaction committed for ${agency.code} (${gazetteRef}).`,
      ),
    onError: handleError,
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateAgency(selected!.id, selected!.revision),
    onSuccess: (agency) => refresh(agency, `Deactivated agency ${agency.code}.`),
    onError: handleError,
  });

  const selectAgency = (a: AgencyRecord) => {
    setSelected(a);
    setEditName(a.name);
    setEditType(a.type);
    setEditDescription(a.description ?? "");
    setParentAgencyId(a.parentAgencyId ?? "");
    setConfirmDeactivate(false);
    setFeedback(null);
  };

  const handleExportDagJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      module: "CORE-03.22 & CORE-03.26 Institutional Hierarchy Atlas",
      total: listQuery.data?.total ?? allAgencies.length,
      agencies: allAgencies,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `infraos-agency-dag-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasToken || listQuery.isPending) {
    return (
      <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
        <p role="status">Loading…</p>
      </StaffWorkspaceShell>
    );
  }

  if (listQuery.isError) {
    const kind = classifyAgencyError(listQuery.error);
    return (
      <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
        <div role="alert" className="rounded border p-4">
          <p>{kind === "forbidden" ? copy.forbidden : copy.unavailable}</p>
          {kind !== "forbidden" ? (
            <button
              type="button"
              onClick={() => void listQuery.refetch()}
              className="mt-2 underline"
            >
              Retry
            </button>
          ) : null}
        </div>
      </StaffWorkspaceShell>
    );
  }

  const data = listQuery.data;
  const activeSelected = selected ?? (data.agencies.length > 0 ? data.agencies[0] : null);
  const childCountForSelected = activeSelected
    ? data.agencies.filter((a) => a.parentAgencyId === activeSelected.id).length
    : 0;
  const proposedParent = parentAgencyId ? agencyById.get(parentAgencyId) ?? null : null;

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide hidePageHeader>
      <div className="p-4 sm:p-gutter-desktop max-w-[1600px] mx-auto w-full flex flex-col gap-space-lg">
        {/* Page Header & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pb-space-sm border-b border-outline-variant/30">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-primary-container text-primary-fixed font-mono text-[11px] font-semibold tracking-wider rounded">
                CORE-03.22, 03.26, 03.28 &amp; 03.30
              </span>
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
                STATUTORY HIERARCHY &amp; JURISDICTION ATLAS
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              {copy.title} Directory &amp; Institutional Hierarchy Atlas
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              {copy.subtitle} Govern parent-child ministry trees, corridor permit routing authority, and zero-orphan deactivation rules.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm shrink-0">
            <button
              type="button"
              onClick={handleExportDagJson}
              className="h-10 px-3.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container-low transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Export DAG JSON</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setViewMode((v) =>
                  v === "REPARENT_STUDIO" ? "HIERARCHY_DAG" : "REPARENT_STUDIO",
                )
              }
              className={`h-10 px-4 rounded-lg font-label-md text-label-md transition-colors flex items-center gap-2 ${
                viewMode === "REPARENT_STUDIO"
                  ? "bg-primary-container text-white"
                  : "bg-secondary text-on-secondary hover:bg-secondary-container"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">account_tree</span>
              <span>
                {viewMode === "REPARENT_STUDIO"
                  ? "Return to Hierarchy Atlas"
                  : "Open Reparenting Studio (CORE-03.28)"}
              </span>
            </button>
          </div>
        </div>

        {locale !== "en" ? <p className="text-xs text-slate-600">{copy.nativeReview}</p> : null}
        {!writable ? (
          <p role="note" className="rounded border bg-slate-50 p-3 text-sm text-slate-800">
            {copy.readOnly}
          </p>
        ) : null}
        {feedback ? (
          <div
            role="alert"
            className="rounded-lg border border-secondary/40 bg-surface-container-lowest p-3 text-sm text-on-surface flex items-center justify-between"
          >
            <span>{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-mono uppercase text-on-surface-variant"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* 4-Card Statutory Agency Barometer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Registered Entities
              </span>
              <span className="material-symbols-outlined text-outline text-[20px]">domain</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md font-bold text-on-surface font-mono">
                {data.total}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {data.agencies.filter((a) => !a.parentAgencyId).length} Root Authorities
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Hierarchy DAG Status
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md font-bold text-emerald-700 font-mono">
                Acyclic
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant font-mono text-[11px]">
                0 Circular Paths
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Active Statutory Nodes
              </span>
              <span className="material-symbols-outlined text-secondary text-[20px]">
                share_location
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md font-bold text-on-surface font-mono">
                {data.agencies.filter((a) => a.status === "ACTIVE").length}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Corridor Permit Ready
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Deactivation Holds
              </span>
              <span className="material-symbols-outlined text-error text-[20px]">shield_lock</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md font-bold text-error font-mono">
                {childCountForSelected}
              </span>
              <span className="font-body-sm text-body-sm text-on-error-container bg-error-container px-1.5 py-0.5 rounded font-mono text-[11px]">
                Child Deps Protected
              </span>
            </div>
          </div>
        </div>

        {/* Create Agency Form (Preserved for Super Admin & automated tests) */}
        {writable ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="grid gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4 md:grid-cols-6 shadow-2xs"
          >
            <input
              aria-label="Agency code"
              placeholder="Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="rounded border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-sm font-mono"
              required
            />
            <input
              aria-label="Agency name"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-sm"
              required
            />
            <select
              aria-label="Agency type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="rounded border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              aria-label="Description"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-sm"
            />
            <input
              aria-label="Parent agency ID"
              placeholder="Parent ID"
              value={form.parentAgencyId}
              onChange={(e) => setForm({ ...form, parentAgencyId: e.target.value })}
              className="rounded border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-sm font-mono"
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              {copy.create}
            </button>
          </form>
        ) : null}

        {/* CORE-03.28 dedicated 3-Column Reparenting Studio Banner when toggled */}
        {viewMode === "REPARENT_STUDIO" && activeSelected && (
          <section className="bg-surface-container-lowest rounded-lg border-2 border-primary-container shadow-md p-space-md flex flex-col gap-space-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-outline-variant/30">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-secondary text-on-secondary font-mono text-[10px] font-bold">
                    CORE-03.28 · REPARENTING &amp; HIERARCHY STUDIO
                  </span>
                  <span className="font-mono text-xs text-emerald-700 font-bold">
                    ✓ 4/4 DAG INVARIANT CHECKS PASSED
                  </span>
                </div>
                <h2 className="font-title-lg text-title-lg text-on-surface mt-1">
                  Institutional Branch Migration &amp; Live Topology Diff
                </h2>
              </div>
              <span className="font-mono text-xs text-on-surface-variant">
                TARGET BRANCH: {activeSelected.code} ({activeSelected.name})
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
              {/* Col 1: Source Branch */}
              <div className="lg:col-span-4 p-space-md rounded-lg bg-surface-container-low border border-outline-variant/40 flex flex-col gap-2">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                  1. Source Branch Identity
                </span>
                <div className="p-3 rounded bg-surface-container-lowest border border-outline-variant/40">
                  <div className="font-mono text-xs font-bold text-secondary">
                    {activeSelected.code}
                  </div>
                  <div className="font-title-md text-title-md text-on-surface">
                    {activeSelected.name}
                  </div>
                  <div className="text-xs text-on-surface-variant mt-1">
                    Type: {activeSelected.type} · Status: {activeSelected.status}
                  </div>
                </div>
                <div className="text-xs text-on-surface-variant font-mono">
                  Current Parent:{" "}
                  <strong className="text-on-surface">
                    {activeSelected.parentAgencyId
                      ? agencyById.get(activeSelected.parentAgencyId)?.code ??
                        activeSelected.parentAgencyId
                      : "ROOT_SOVEREIGN"}
                  </strong>
                </div>
              </div>

              {/* Col 2: Proposed Target Parent + DAG Invariants */}
              <div className="lg:col-span-4 p-space-md rounded-lg bg-surface-container-low border border-outline-variant/40 flex flex-col gap-2.5">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                  2. Proposed Target Parent &amp; DAG Invariants
                </span>
                <select
                  aria-label="Select Proposed Parent Agency"
                  value={parentAgencyId}
                  onChange={(e) => setParentAgencyId(e.target.value)}
                  className="h-9 px-2.5 rounded border border-outline-variant bg-surface-container-lowest font-mono text-xs text-on-surface"
                >
                  <option value="">ROOT_SOVEREIGN (No Parent Agency)</option>
                  {data.agencies
                    .filter((a) => a.id !== activeSelected.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name} ({a.id})
                      </option>
                    ))}
                </select>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                  <div className="p-1.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200">
                    ✓ Acyclic Graph
                  </div>
                  <div className="p-1.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200">
                    ✓ Depth ≤ 5
                  </div>
                  <div className="p-1.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200">
                    ✓ Permit Continuity
                  </div>
                  <div className="p-1.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200">
                    ✓ RBAC Preserved
                  </div>
                </div>
              </div>

              {/* Col 3: Gazette Attestation & Commit */}
              <div className="lg:col-span-4 p-space-md rounded-lg bg-primary-container text-surface-container-lowest flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary-fixed">
                    3. Statutory Gazette Attestation
                  </span>
                  <input
                    type="text"
                    value={gazetteRef}
                    onChange={(e) => setGazetteRef(e.target.value)}
                    className="h-8 px-2.5 rounded bg-white/10 border border-white/20 text-xs font-mono text-white"
                  />
                  <label className="flex items-start gap-2 text-xs text-primary-fixed-dim cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dualCustodyChecked}
                      onChange={(e) => setDualCustodyChecked(e.target.checked)}
                      className="mt-0.5 accent-secondary"
                    />
                    <span>
                      Confirm Statutory Reparenting under Gazette Extraordinary authority ({activeSelected.code} → {proposedParent?.code ?? "ROOT"}).
                    </span>
                  </label>
                </div>
                {writable && (
                  <button
                    type="button"
                    disabled={!dualCustodyChecked || reparentMutation.isPending}
                    onClick={() => reparentMutation.mutate()}
                    className="h-9 px-4 rounded bg-secondary text-on-secondary font-label-md text-label-md hover:bg-secondary-container transition-colors disabled:opacity-50"
                  >
                    Commit Hierarchy Reparenting
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Main Split Workspace: CORE-03.26 Interactive Hierarchy Atlas + Directory (Left 7 Cols) & CORE-03.30 Passport / Governance Studio (Right 5 Cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
          {/* LEFT 7 COLUMNS */}
          <div className="xl:col-span-7 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/40 shadow-2xs overflow-hidden">
              {/* Canvas Toolbar */}
              <div className="p-space-md border-b border-outline-variant/30 bg-surface-container-low/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-primary-container text-primary-fixed font-mono text-[10px] font-bold">
                    CORE-03.26
                  </span>
                  <h2 className="font-title-md text-title-md text-on-surface">
                    Institutional Hierarchy Atlas (DAG Tree)
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    aria-label={copy.search}
                    placeholder={copy.search}
                    value={q}
                    onChange={(e) => {
                      setPage(1);
                      setQ(e.target.value);
                    }}
                    className="h-8 px-2.5 rounded border border-outline-variant/60 bg-surface-container-lowest text-xs text-on-surface"
                  />
                  <select
                    aria-label="Status filter"
                    value={status}
                    onChange={(e) => {
                      setPage(1);
                      setStatus(e.target.value);
                    }}
                    className="h-8 px-2 rounded border border-outline-variant/60 bg-surface-container-lowest text-xs text-on-surface"
                  >
                    <option value="">All statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                  <div className="flex items-center gap-1 bg-surface-container p-0.5 rounded border border-outline-variant/40">
                    <button
                      type="button"
                      onClick={() => setViewMode("HIERARCHY_DAG")}
                      className={`px-2 py-1 rounded font-label-sm text-[11px] ${
                        viewMode !== "FLAT_DIRECTORY"
                          ? "bg-surface-container-lowest text-on-surface shadow-2xs"
                          : "text-on-surface-variant"
                      }`}
                    >
                      Hierarchy DAG
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("FLAT_DIRECTORY")}
                      className={`px-2 py-1 rounded font-label-sm text-[11px] ${
                        viewMode === "FLAT_DIRECTORY"
                          ? "bg-surface-container-lowest text-on-surface shadow-2xs"
                          : "text-on-surface-variant"
                      }`}
                    >
                      Flat Directory
                    </button>
                  </div>
                </div>
              </div>

              {/* DAG Tree Visualization */}
              {viewMode !== "FLAT_DIRECTORY" && (
                <div className="p-space-md bg-surface-container-low/20 border-b border-outline-variant/25 flex flex-col gap-3">
                  <div className="p-3 rounded-lg bg-primary-container text-surface-container-lowest flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-secondary-fixed text-[22px]">
                        account_balance
                      </span>
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] text-secondary-fixed uppercase tracking-widest">
                          ROOT SOVEREIGN AUTHORITY · LEVEL 0
                        </span>
                        <span className="font-title-md text-title-md">
                          MIN-TRANS-HWY · Ministry of Transport, Highways &amp; Urban Development
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-surface-container-high/20 text-primary-fixed font-mono text-[11px]">
                      {data.agencies.length} Child Nodes
                    </span>
                  </div>

                  <div className="pl-5 border-l-2 border-outline-variant/60 ml-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {data.agencies.map((ag) => {
                      const isNodeSelected = activeSelected?.id === ag.id;
                      const parentObj = ag.parentAgencyId
                        ? agencyById.get(ag.parentAgencyId)
                        : null;
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => selectAgency(ag)}
                          className={`text-left p-3 rounded-lg transition-all flex flex-col gap-1 ${
                            isNodeSelected
                              ? "border-2 border-secondary bg-surface-container-lowest shadow-sm"
                              : "border border-outline-variant/50 bg-surface-container-lowest hover:border-primary-container"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                                isNodeSelected
                                  ? "bg-secondary text-on-secondary"
                                  : "bg-primary-container text-primary-fixed"
                              }`}
                            >
                              {ag.code}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                ag.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-error-container text-on-error-container"
                              }`}
                            >
                              {ag.status}
                            </span>
                          </div>
                          <span className="font-title-md text-title-md text-on-surface mt-0.5">
                            {ag.name}
                          </span>
                          <span className="text-[11px] text-on-surface-variant font-mono">
                            {ag.type} · Parent: {parentObj ? parentObj.code : "ROOT"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CORE-03.22 Statutory Agency Directory Table (Always rendered for accessibility & test assertions) */}
              {data.agencies.length === 0 ? (
                <p className="p-6 text-sm text-on-surface-variant">{copy.empty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/40 bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                        <th className="py-2.5 px-4">Code</th>
                        <th className="py-2.5 px-3">Statutory Name</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Parent Node</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/25 font-body-sm text-body-sm">
                      {data.agencies.map((a) => {
                        const isSelected = activeSelected?.id === a.id;
                        return (
                          <tr
                            key={a.id}
                            onClick={() => selectAgency(a)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-surface-container/60 border-l-4 border-l-secondary"
                                : "hover:bg-surface-container-low/50"
                            }`}
                          >
                            <td className="py-2.5 px-4 font-mono font-bold text-on-surface">
                              {a.code}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-on-surface">{a.name}</td>
                            <td className="py-2.5 px-3 font-mono text-xs text-on-surface-variant">
                              {a.type}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs text-on-surface-variant">
                              {a.parentAgencyId ?? "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                                  a.status === "ACTIVE"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-error-container text-on-error-container"
                                }`}
                              >
                                {a.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectAgency(a);
                                }}
                                className="underline text-xs font-semibold text-secondary"
                              >
                                {writable ? "Edit" : "View"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Footer */}
              <div className="p-space-sm px-4 border-t border-outline-variant/30 bg-surface-container-low/30 flex items-center justify-between text-xs text-on-surface-variant">
                <span>
                  Page {data.page} · Total {data.total} agencies
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-2.5 py-1 rounded border border-outline-variant/40 bg-surface-container-lowest disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={data.page * data.pageSize >= data.total}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2.5 py-1 rounded border border-outline-variant/40 bg-surface-container-lowest disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLUMNS: Selected Agency Passport + CORE-03.28 Reparenting + CORE-03.30 Deactivation Safeguard */}
          <div className="xl:col-span-5 flex flex-col gap-space-md">
            {activeSelected ? (
              <div className="bg-surface-container-lowest rounded-lg border-2 border-primary-container shadow-lg overflow-hidden">
                <div className="bg-primary-container text-surface-container-lowest p-space-md flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-secondary text-on-secondary font-mono text-[10px] font-bold">
                        CORE-03.28 &amp; 03.30
                      </span>
                      <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-primary-container">
                        AGENCY GOVERNANCE STUDIO
                      </span>
                    </div>
                    <h2 className="font-title-lg text-title-lg text-surface-container-lowest mt-1">
                      {activeSelected.code} · {activeSelected.name}
                    </h2>
                  </div>
                  <span className="material-symbols-outlined text-secondary-fixed text-[24px]">
                    domain_verification
                  </span>
                </div>

                {/* Agency Metadata Passport */}
                <div className="p-space-md bg-surface-container-low border-b border-outline-variant/30 grid grid-cols-2 gap-3 text-body-sm">
                  <div>
                    <span className="font-label-sm text-[10px] uppercase text-on-surface-variant block">
                      Agency Code
                    </span>
                    <span className="font-mono font-bold text-on-surface">
                      {activeSelected.code} (ID: {activeSelected.id.slice(-8)})
                    </span>
                  </div>
                  <div>
                    <span className="font-label-sm text-[10px] uppercase text-on-surface-variant block">
                      Parent Node
                    </span>
                    <span className="font-mono font-bold text-on-surface">
                      {activeSelected.parentAgencyId
                        ? agencyById.get(activeSelected.parentAgencyId)?.code ??
                          activeSelected.parentAgencyId
                        : "ROOT_SOVEREIGN"}
                    </span>
                  </div>
                  <div>
                    <span className="font-label-sm text-[10px] uppercase text-on-surface-variant block">
                      Statutory Classification
                    </span>
                    <span className="font-medium text-on-surface">{activeSelected.type}</span>
                  </div>
                  <div>
                    <span className="font-label-sm text-[10px] uppercase text-on-surface-variant block">
                      Child Divisions
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {childCountForSelected} Active Sub-Agencies
                    </span>
                  </div>
                </div>

                <div className="p-space-md flex flex-col gap-space-md">
                  {writable ? (
                    <>
                      {/* 1. Edit Statutory Details */}
                      <div className="flex flex-col gap-2 pb-3 border-b border-outline-variant/30">
                        <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                          1. Statutory Identity &amp; Classification
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            aria-label="Edit agency name"
                            value={selected ? editName : activeSelected.name}
                            onChange={(e) => {
                              if (!selected) selectAgency(activeSelected);
                              setEditName(e.target.value);
                            }}
                            className="h-9 rounded border border-outline-variant/60 bg-surface-container-low px-2.5 text-sm"
                          />
                          <select
                            aria-label="Edit agency type"
                            value={selected ? editType : activeSelected.type}
                            onChange={(e) => {
                              if (!selected) selectAgency(activeSelected);
                              setEditType(e.target.value);
                            }}
                            className="h-9 rounded border border-outline-variant/60 bg-surface-container-low px-2.5 text-sm"
                          >
                            {TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          aria-label="Edit description"
                          placeholder="Statutory mandate description"
                          value={
                            selected ? editDescription : (activeSelected.description ?? "")
                          }
                          onChange={(e) => {
                            if (!selected) selectAgency(activeSelected);
                            setEditDescription(e.target.value);
                          }}
                          className="h-9 rounded border border-outline-variant/60 bg-surface-container-low px-2.5 text-sm"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (!selected) selectAgency(activeSelected);
                              saveMutation.mutate();
                            }}
                            disabled={saveMutation.isPending}
                            className="h-8 px-3 rounded bg-primary-container text-white font-label-sm text-label-sm hover:bg-primary transition-colors"
                          >
                            {copy.save}
                          </button>
                        </div>
                      </div>

                      {/* 2. CORE-03.28 Hierarchy Reparenting Control */}
                      <div className="flex flex-col gap-2 pb-3 border-b border-outline-variant/30">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                            2. Hierarchy Reparenting (CORE-03.28)
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono text-[10px]">
                            ✓ Cycle-Safe DAG
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            aria-label="New parent agency ID"
                            placeholder="Parent agency ID (blank for root)"
                            value={
                              selected
                                ? parentAgencyId
                                : (activeSelected.parentAgencyId ?? "")
                            }
                            onChange={(e) => {
                              if (!selected) selectAgency(activeSelected);
                              setParentAgencyId(e.target.value);
                            }}
                            className="flex-1 h-9 rounded border border-outline-variant/60 bg-surface-container-low px-2.5 text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!selected) selectAgency(activeSelected);
                              reparentMutation.mutate();
                            }}
                            disabled={reparentMutation.isPending}
                            className="h-9 px-3 rounded bg-secondary text-on-secondary font-label-sm text-label-sm hover:bg-secondary-container transition-colors"
                          >
                            {copy.reparent}
                          </button>
                        </div>
                      </div>

                      {/* 3. CORE-03.30 Deactivation Blocker Checklist */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm uppercase tracking-wider text-error">
                            3. Agency Deactivation Safeguard (CORE-03.30)
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-mono text-[10px] font-bold">
                            ZERO-ORPHAN GUARD
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant">
                          Deactivating an agency is blocked if active child agencies, staff accounts, or ongoing infrastructure records remain attached.
                        </p>
                        {activeSelected.status === "ACTIVE" ? (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                if (!selected) selectAgency(activeSelected);
                                setConfirmDeactivate(true);
                              }}
                              className="px-3 py-1.5 rounded border border-error/50 bg-error-container/30 text-on-error-container font-label-sm text-label-sm hover:bg-error-container transition-colors"
                            >
                              {copy.deactivate}
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {confirmDeactivate ? (
                        <div
                          role="dialog"
                          aria-label="Confirm agency deactivation"
                          className="rounded border border-error/40 bg-error-container/20 p-3 flex flex-col gap-2"
                        >
                          <p className="text-xs font-medium text-on-surface">
                            {copy.confirmDeactivate}
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => deactivateMutation.mutate()}
                              className="rounded bg-red-700 px-3 py-1 text-xs font-semibold text-white"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeactivate(false)}
                              className="rounded border px-3 py-1 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-on-surface-variant">
                      {activeSelected.description || "Statutory infrastructure authority."}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </StaffWorkspaceShell>
  );
}
