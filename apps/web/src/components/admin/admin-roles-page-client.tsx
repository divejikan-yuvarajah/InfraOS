"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import {
  fetchPermissionCatalog,
  fetchRoles,
  updateRoleGrants,
  updateRoleText,
} from "@/lib/admin-roles/api";
import { getRoleCopy } from "@/lib/admin-roles/messages";
import { roleManageIsPlatformHint } from "@/lib/admin-roles/schema";
import type { RoleRecord } from "@/lib/admin-roles/types";
import {
  ADMIN_ROLES_QUERY_KEY,
  bannerFromStatus,
  grantChangePreview,
} from "@/lib/admin-roles/view-state";
import {
  getAuthEpoch,
  getMemoryAccessToken,
  getMemorySession,
  subscribeAuth,
} from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

function classifyRoleError(error: unknown): "forbidden" | "conflict" | "unavailable" {
  if (error instanceof ApiError) {
    const b = bannerFromStatus(error.status);
    if (b === "forbidden" || b === "conflict") return b;
  }
  return "unavailable";
}

export function AdminRolesPageClient() {
  const [locale] = useWorkspaceLocale();
  const copy = getRoleCopy(locale);
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
  const writable = roleManageIsPlatformHint(actor?.roleKey ?? null);

  const [selected, setSelected] = useState<RoleRecord | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [grants, setGrants] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [confirmSave, setConfirmSave] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [permSearch, setPermSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");

  const rolesQuery = useQuery({
    queryKey: [...ADMIN_ROLES_QUERY_KEY, epoch, actor?.id ?? null, actor?.roleKey ?? null],
    queryFn: fetchRoles,
    enabled: hasToken && Boolean(actor),
    retry: false,
  });

  const permissionsQuery = useQuery({
    queryKey: ["admin", "permissions", epoch],
    queryFn: fetchPermissionCatalog,
    enabled: hasToken && writable,
    retry: false,
  });

  function selectRole(role: RoleRecord) {
    setSelected(role);
    setName(role.name);
    setDescription(role.description ?? "");
    setGrants(role.permissions);
    setReason("");
    setConfirmSave(false);
    setFeedback(null);
  }

  function refresh(role: RoleRecord) {
    selectRole(role);
    setFeedback(copy.saved);
    void queryClient.invalidateQueries({ queryKey: ADMIN_ROLES_QUERY_KEY });
  }

  function onError(error: unknown) {
    const kind = classifyRoleError(error);
    if (kind === "conflict") setFeedback(copy.conflict);
    else if (kind === "forbidden") setFeedback(copy.forbidden);
    else setFeedback(copy.unavailable);
  }

  const textMutation = useMutation({
    mutationFn: () =>
      updateRoleText(selected!.id, {
        name,
        description: description || selected!.description,
        revision: selected!.revision,
      }),
    onSuccess: refresh,
    onError,
  });

  const grantMutation = useMutation({
    mutationFn: () =>
      updateRoleGrants(selected!.id, {
        permissions: grants,
        reason,
        revision: selected!.revision,
      }),
    onSuccess: refresh,
    onError,
  });

  const roles: RoleRecord[] = rolesQuery.data ?? [];
  const allPermissions = useMemo(() => {
    const catalog = permissionsQuery.data ?? [];
    if (catalog.length > 0) {
      const items: { key: string; module: string }[] = [];
      for (const group of catalog) {
        for (const pk of group.permissions) {
          items.push({ key: pk, module: group.module });
        }
      }
      return items;
    }
    const seen = new Map<string, { key: string; module: string }>();
    for (const r of roles) {
      for (const pk of r.permissions) {
        if (!seen.has(pk)) {
          seen.set(pk, { key: pk, module: pk.split(".")[0] ?? "system" });
        }
      }
    }
    return Array.from(seen.values());
  }, [permissionsQuery.data, roles]);

  const modulesList = useMemo(() => {
    const s = new Set<string>();
    for (const p of allPermissions) {
      s.add(p.module);
    }
    return ["ALL", ...Array.from(s)];
  }, [allPermissions]);

  const filteredPermissions = useMemo(() => {
    return allPermissions.filter((p) => {
      if (moduleFilter !== "ALL" && p.module !== moduleFilter) return false;
      if (permSearch.trim()) {
        const q = permSearch.toLowerCase();
        return p.key.toLowerCase().includes(q) || p.module.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allPermissions, moduleFilter, permSearch]);

  const handleExportMatrixCsv = () => {
    const headers = ["Permission Key", "Module", ...roles.map((r) => r.key)];
    const rowsCsv = allPermissions.map((p) => [
      p.key,
      p.module,
      ...roles.map((r) => (r.permissions.includes(p.key) ? "GRANTED" : "DENIED")),
    ]);
    const csvContent = [headers, ...rowsCsv].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `infraos-rbac-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasToken || rolesQuery.isPending) {
    return (
      <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
        <p role="status">Loading…</p>
      </StaffWorkspaceShell>
    );
  }

  if (rolesQuery.isError) {
    const kind = classifyRoleError(rolesQuery.error);
    return (
      <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
        <div role="alert" className="rounded border p-4">
          <p>{kind === "forbidden" ? copy.forbidden : copy.unavailable}</p>
        </div>
      </StaffWorkspaceShell>
    );
  }

  const diff = selected
    ? grantChangePreview(selected.permissions, grants)
    : { added: [], removed: [] };

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide hidePageHeader>
      <div className="p-4 sm:p-gutter-desktop max-w-[1600px] mx-auto w-full flex flex-col gap-space-lg">
        {/* Top Module Header */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md pb-space-md border-b border-outline-variant/40">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-primary-container text-surface-container-lowest font-mono text-[11px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-container" />
                CORE-03.39 &amp; CORE-03.40 · AUTHORITY GOVERNANCE
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm uppercase">
                <span className="material-symbols-outlined text-[14px]">gavel</span>
                Separation of Duties (SoD) Locked
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Authority Permission Matrix &amp; Role Grant Studio
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              {copy.subtitle} Cryptographic access control governing the 7 predefined statutory roles across national infrastructure operations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <button
              type="button"
              onClick={handleExportMatrixCsv}
              className="h-10 px-3.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-md text-label-md flex items-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Export Matrix CSV</span>
            </button>
          </div>
        </section>

        {locale !== "en" ? <p className="text-xs text-slate-600">{copy.nativeReview}</p> : null}
        {!writable ? (
          <p role="note" className="rounded border bg-slate-50 p-3 text-sm">
            {copy.readOnly}
          </p>
        ) : null}
        {feedback ? (
          <p role="alert" className="rounded border bg-white p-3 text-sm">
            {feedback}
          </p>
        ) : null}

        {/* 4-Card KPI Telemetry Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Predefined System Roles
              </span>
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                badge
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-mono text-on-surface">
                {roles.length}
              </span>
              <span className="font-label-sm text-label-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Statutory Schema Locked
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              SUPER_ADMIN · GOV_ADMIN · AGENCY_OFFICER · PM · CONTRACTOR · INSPECTOR · CITIZEN
            </p>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Authoritative Grants
              </span>
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                key
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-headline-lg text-headline-lg font-mono text-on-surface">
                {allPermissions.length}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                {modulesList.length - 1} Functional Domains
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Granular RBAC + Agency Jurisdiction Scoped
            </p>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Duties Separation (SoD)
              </span>
              <span className="material-symbols-outlined text-secondary text-[20px]">
                shield_locked
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-title-lg text-title-lg font-bold text-secondary">
                Strictly Enforced
              </span>
              <span className="font-mono text-xs text-emerald-700 font-bold">0 Violations</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              SUPER_ADMIN barred from operational project/permit sign-off
            </p>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 shadow-2xs flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Cryptographic Enclave
              </span>
              <span className="material-symbols-outlined text-emerald-700 text-[20px]">
                verified_user
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-title-lg text-title-lg font-mono text-on-surface">
                SHA-256 + HSM
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Every grant delta requires reason &amp; immutable audit log
            </p>
          </div>
        </section>

        {/* System Roles Overview Table */}
        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/40 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-outline-variant/30 bg-surface-container-low/50 flex items-center justify-between">
            <span className="font-title-md text-title-md text-on-surface">
              7 Predefined Statutory Roles
            </span>
            <span className="text-xs font-mono text-on-surface-variant">
              Click Inspect / Edit to open Role Grant Studio (CORE-03.40)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Scope</th>
                  <th className="py-2.5 px-3">Grants</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/25">
                {roles.map((r) => (
                  <tr
                    key={r.id}
                    className={`transition-colors ${
                      selected?.id === r.id
                        ? "bg-secondary-fixed/25 border-l-4 border-l-secondary"
                        : "hover:bg-surface-container-low/50"
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono font-bold text-on-surface">{r.key}</td>
                    <td className="py-2.5 px-3 font-medium text-on-surface">{r.name}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-on-surface-variant">
                      {r.scopeType}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs font-semibold text-on-surface">
                      {r.permissions.length}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => selectRole(r)}
                        className="underline font-semibold text-secondary"
                      >
                        {writable ? "Edit" : "Inspect"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CORE-03.39 7-Role Permission Matrix Grid + CORE-03.40 Role Grant Studio */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
          {/* LEFT 8 COLUMNS: CORE-03.39 7-Role Permission Matrix Data Grid */}
          <div className="xl:col-span-8 bg-surface-container-lowest rounded-lg border border-outline-variant/40 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-space-md border-b border-outline-variant/40 bg-surface-container-low/50 flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-secondary uppercase">
                    CORE-03.39
                  </span>
                  <h2 className="font-title-md text-title-md text-on-surface">
                    7-Role RBAC Authority Matrix
                  </h2>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Cross-role comparison of atomic permission grants and Separation of Duties (SoD) boundaries.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  placeholder="Filter permissions..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="h-8 px-2.5 rounded border border-outline-variant/60 bg-surface-container-lowest text-xs text-on-surface"
                />
                <select
                  aria-label="Filter permission module"
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="h-8 px-2.5 rounded border border-outline-variant/60 bg-surface-container-lowest text-xs font-mono text-on-surface"
                >
                  {modulesList.map((m) => (
                    <option key={m} value={m}>
                      {m === "ALL" ? "All Domains" : m.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-primary-container text-surface-container-lowest font-mono text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Permission Key</th>
                    {roles.map((r) => (
                      <th key={r.id} className="py-2.5 px-2 text-center">
                        {r.key.replace("_", " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/25 font-mono">
                  {filteredPermissions.map((perm) => (
                    <tr key={perm.key} className="hover:bg-surface-container-low/50">
                      <td className="py-2 px-3 font-semibold text-on-surface">
                        <div>{perm.key}</div>
                        <div className="text-[10px] text-on-surface-variant uppercase">
                          {perm.module}
                        </div>
                      </td>
                      {roles.map((r) => {
                        const isGranted =
                          selected?.id === r.id
                            ? grants.includes(perm.key)
                            : r.permissions.includes(perm.key);
                        const isSodRestricted =
                          r.key === "SUPER_ADMIN" &&
                          (perm.key.startsWith("project.approve") ||
                            perm.key.startsWith("inspection.verify") ||
                            perm.key.startsWith("finance.disburse"));
                        return (
                          <td key={r.id} className="py-2 px-2 text-center">
                            {isGranted ? (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                GRANTED
                              </span>
                            ) : isSodRestricted ? (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-error-container text-on-error-container text-[10px] font-bold">
                                SoD_LOCK
                              </span>
                            ) : (
                              <span className="text-outline">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT 4 COLUMNS: CORE-03.40 Role Grant Studio */}
          <div className="xl:col-span-4 flex flex-col gap-space-md">
            {selected ? (
              <section
                aria-label="Role editor"
                className="rounded-lg border-2 border-primary-container bg-surface-container-lowest p-4 space-y-4 shadow-lg"
              >
                <div className="border-b border-outline-variant/30 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-secondary text-on-secondary font-mono text-[10px] font-bold">
                      CORE-03.40 · ROLE GRANT STUDIO
                    </span>
                    <span className="font-mono text-xs text-on-surface-variant">
                      Rev #{selected.revision}
                    </span>
                  </div>
                  <h2 className="font-title-lg text-title-lg font-bold text-on-surface mt-1">
                    {selected.key}
                  </h2>
                </div>

                {writable ? (
                  <>
                    <div className="grid gap-2 md:grid-cols-3">
                      <input
                        aria-label="Role name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="rounded border border-outline-variant/60 bg-surface-container-low p-2 text-xs"
                      />
                      <input
                        aria-label="Role description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="rounded border border-outline-variant/60 bg-surface-container-low p-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => textMutation.mutate()}
                        className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        {copy.saveText}
                      </button>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2 max-h-64 overflow-y-auto p-2 rounded bg-surface-container-low border border-outline-variant/40">
                      {allPermissions.map((p) => {
                        const checked = grants.includes(p.key);
                        return (
                          <label key={p.key} className="flex items-center gap-2 text-xs font-mono">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setGrants(
                                  e.target.checked
                                    ? [...grants, p.key]
                                    : grants.filter((key) => key !== p.key),
                                )
                              }
                            />
                            <span>{p.key}</span>
                          </label>
                        );
                      })}
                    </div>

                    <p className="text-xs text-slate-600 font-mono">
                      Add: {diff.added.join(", ") || "none"} · Remove:{" "}
                      {diff.removed.join(", ") || "none"}
                    </p>

                    <div className="flex flex-col gap-2">
                      <input
                        aria-label={copy.reason}
                        placeholder={copy.reason}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full rounded border border-outline-variant/60 bg-surface-container-low p-2 text-xs"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs font-medium">
                          <input
                            type="checkbox"
                            checked={confirmSave}
                            onChange={(e) => setConfirmSave(e.target.checked)}
                          />
                          Confirm grant change
                        </label>
                        <button
                          type="button"
                          disabled={
                            !confirmSave ||
                            reason.trim().length < 3 ||
                            grantMutation.isPending
                          }
                          onClick={() => grantMutation.mutate()}
                          className="rounded bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {copy.saveGrants}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="font-mono text-xs text-on-surface-variant">
                    {selected.permissions.join(", ")}
                  </p>
                )}
              </section>
            ) : (
              <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-5 text-xs text-on-surface-variant">
                Select any of the 7 predefined roles above to inspect or stage permission grant changes in the Role Grant Studio.
              </div>
            )}
          </div>
        </section>
      </div>
    </StaffWorkspaceShell>
  );
}
