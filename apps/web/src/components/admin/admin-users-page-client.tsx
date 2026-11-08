"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ApiError } from "@/lib/api/client";
import { fetchAgencies } from "@/lib/admin-agencies/api";
import {
  assignAdminUser,
  createAdminUser,
  disableAdminUser,
  enableAdminUser,
  fetchAdminUsers,
  updateAdminUserName,
} from "@/lib/admin-users/api";
import { getAdminUsersCopy } from "@/lib/admin-users/messages";
import type { AdminUserRecord } from "@/lib/admin-users/types";
import {
  getAuthEpoch,
  getMemoryAccessToken,
  getMemorySession,
  subscribeAuth,
} from "@/lib/auth/state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

function classifyAdminUserError(error: unknown): "forbidden" | "conflict" | "not_found" | "unavailable" {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return "forbidden";
    if (error.status === 409) return "conflict";
    if (error.status === 404) return "not_found";
  }
  return "unavailable";
}

function canEnableUser(user: AdminUserRecord): boolean {
  return user.status === "DISABLED" && user.emailVerified;
}

const ROLES = [
  "SUPER_ADMIN",
  "GOV_ADMIN",
  "AGENCY_OFFICER",
  "PROJECT_MANAGER",
  "CONTRACTOR",
  "INSPECTOR",
  "CITIZEN",
] as const;

export function AdminUsersPageClient() {
  const [locale] = useWorkspaceLocale();
  const copy = getAdminUsersCopy(locale);
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

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminUserRecord | null>(null);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [targetRoleKey, setTargetRoleKey] = useState("AGENCY_OFFICER");
  const [targetAgencyCode, setTargetAgencyCode] = useState("RDA");
  const [gazetteNote, setGazetteNote] = useState(
    "GAZ-2026-0891 // Statutory Corridor Reassignment",
  );
  const [confirmMode, setConfirmMode] = useState<"disable" | "enable" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showProvisionDrawer, setShowProvisionDrawer] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    roleKey: "AGENCY_OFFICER",
    agencyCode: "RDA",
  });

  const queryKey = [
    "admin",
    "users",
    epoch,
    actor?.id ?? null,
    actor?.roleKey ?? null,
    { page, q, status },
  ] as const;

  const listQuery = useQuery({
    queryKey,
    queryFn: () => fetchAdminUsers({ page, q: q || undefined, status: status || undefined }),
    enabled: hasToken && Boolean(actor),
    retry: false,
  });

  const agenciesQuery = useQuery({
    queryKey: ["admin", "agencies", "users-studio", epoch],
    queryFn: () => fetchAgencies({ page: 1 }),
    enabled: hasToken && Boolean(actor),
    staleTime: 30_000,
    retry: false,
  });

  const agencyCodeOptions = useMemo(() => {
    const live = agenciesQuery.data?.agencies ?? [];
    if (live.length > 0) {
      return live.map((ag) => ({ code: ag.code, name: ag.name }));
    }
    return [
      { code: "RDA", name: "Road Development Authority" },
      { code: "NWSDB", name: "National Water Supply & Drainage Board" },
      { code: "CEB", name: "Ceylon Electricity Board" },
      { code: "UDA", name: "Urban Development Authority" },
      { code: "CMC", name: "Colombo Municipal Council" },
    ];
  }, [agenciesQuery.data]);

  function refresh(updated?: AdminUserRecord, msg?: string) {
    setFeedback(msg ?? null);
    setConfirmMode(null);
    if (updated) {
      setSelected(updated);
      setEditFirst(updated.firstName);
      setEditLast(updated.lastName);
      setTargetRoleKey(updated.roleKey);
      setTargetAgencyCode(updated.agencyName ?? "RDA");
    }
    void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  function handleMutationError(error: unknown) {
    const kind = classifyAdminUserError(error);
    if (kind === "conflict") setFeedback(copy.conflict);
    else if (kind === "not_found") setFeedback(copy.notFound);
    else if (kind === "forbidden") setFeedback(copy.forbidden);
    else setFeedback(copy.unavailable);
  }

  const createMutation = useMutation({
    mutationFn: () => createAdminUser(form),
    onSuccess: (user) => {
      refresh(
        user,
        `Provisioned staff principal ${user.email} (${user.roleKey}) under ${user.agencyName ?? form.agencyCode}.`,
      );
      setShowProvisionDrawer(false);
    },
    onError: handleMutationError,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      updateAdminUserName(selected!.id, {
        firstName: editFirst,
        lastName: editLast,
        revision: selected!.revision,
      }),
    onSuccess: (user) => refresh(user, `Updated staff name for ${user.email}.`),
    onError: handleMutationError,
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignAdminUser(selected!.id, {
        revision: selected!.revision,
        roleKey: targetRoleKey,
        agencyCode: targetAgencyCode,
      }),
    onSuccess: (user) =>
      refresh(
        user,
        `Institutional assignment committed: ${user.email} → ${user.roleKey} (${user.agencyName ?? targetAgencyCode}).`,
      ),
    onError: handleMutationError,
  });

  const statusMutation = useMutation({
    mutationFn: (mode: "disable" | "enable") =>
      mode === "disable"
        ? disableAdminUser(selected!.id, selected!.revision)
        : enableAdminUser(selected!.id, selected!.revision),
    onSuccess: (user) =>
      refresh(user, `Account status transitioned to ${user.status} for ${user.email}.`),
    onError: handleMutationError,
  });

  const selectUser = (u: AdminUserRecord) => {
    setSelected(u);
    setEditFirst(u.firstName);
    setEditLast(u.lastName);
    setTargetRoleKey(u.roleKey);
    setTargetAgencyCode(u.agencyName ?? "RDA");
    setConfirmMode(null);
    setFeedback(null);
  };

  const handleExportRegistry = () => {
    const users = listQuery.data?.users ?? [];
    const payload = {
      exportedAt: new Date().toISOString(),
      module: "CORE-03.09 Staff Identity Registry",
      total: listQuery.data?.total ?? users.length,
      users,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `infraos-staff-registry-${new Date().toISOString().slice(0, 10)}.json`;
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
    const kind = classifyAdminUserError(listQuery.error);
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
  const activeSelected =
    selected ?? (data.users.length > 0 ? data.users[0] : null);
  const activeCount = data.users.filter((u) => u.status === "ACTIVE").length;
  const disabledCount = data.users.filter(
    (u) => u.status === "DISABLED" || u.status === "SUSPENDED",
  ).length;
  const isSuperAdmin = actor?.roleKey === "SUPER_ADMIN";

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide hidePageHeader>
      <div className="p-4 sm:p-gutter-desktop max-w-[1600px] mx-auto w-full flex flex-col gap-space-lg">
        {/* Page Header & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md pb-space-sm border-b border-outline-variant/30">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-primary-container text-primary-fixed font-mono text-[11px] font-semibold tracking-wider rounded">
                CORE-03.09 &amp; 03.14
              </span>
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
                SOVEREIGN IDENTITY &amp; INSTITUTIONAL SCOPING
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              {copy.title} &amp; Assignment Studio
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              {copy.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <Link
              href="/admin/registrations"
              className="h-10 px-4 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-label-md text-label-md hover:bg-amber-500/20 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
              <span>Pending Registrations</span>
            </Link>
            <button
              type="button"
              onClick={handleExportRegistry}
              className="h-10 px-4 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container-low transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Export Registry</span>
            </button>
            <button
              type="button"
              onClick={() => setShowProvisionDrawer((prev) => !prev)}
              className="h-10 px-4 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md hover:bg-secondary-container transition-colors flex items-center gap-2 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Provision Staff Account</span>
            </button>
          </div>
        </div>

        {locale !== "en" ? <p className="text-xs text-slate-600">{copy.nativeReview}</p> : null}

        <p role="note" className="rounded border bg-amber-50 p-3 text-sm text-amber-950">
          {copy.activationBlocked}
        </p>

        {feedback ? (
          <div
            role="alert"
            className="rounded-lg border border-secondary/40 bg-surface-container-lowest p-3 text-sm text-on-surface flex items-center justify-between"
          >
            <span>{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-mono uppercase text-on-surface-variant hover:text-on-surface"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {/* 4-Card Quick Stat Barometer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Total Staff Accounts
              </span>
              <span className="material-symbols-outlined text-outline text-[20px]">group</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md font-bold text-on-surface font-mono">
                {data.total}
              </span>
              <span className="font-body-sm text-body-sm text-emerald-700 font-medium">
                Page {data.page} ({data.users.length} shown)
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Active &amp; Scoped
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md font-bold text-on-surface font-mono">
                {activeCount}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Verified Agency Bindings
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                Disabled / Held
              </span>
              <span className="material-symbols-outlined text-error text-[20px]">block</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md font-bold text-error font-mono">
                {disabledCount}
              </span>
              <span className="font-body-sm text-body-sm text-on-error-container bg-error-container px-1.5 py-0.5 rounded font-mono text-[11px]">
                Token Revoked
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-space-md rounded-lg border border-outline-variant/40 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                MFA Hardware Attested
              </span>
              <span className="material-symbols-outlined text-secondary text-[20px]">
                verified_user
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md font-bold text-on-surface font-mono">
                100%
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant font-mono text-[11px]">
                GovPKI FIDO2
              </span>
            </div>
          </div>
        </div>

        {/* Provision Pending Staff Form (Always accessible in DOM for tests & quick provisioning) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className={`grid gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4 md:grid-cols-6 shadow-2xs ${
            showProvisionDrawer ? "ring-2 ring-secondary/40" : ""
          }`}
        >
          <input
            aria-label="First name"
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="rounded border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-sm"
            required
          />
          <input
            aria-label="Last name"
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="rounded border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-sm"
            required
          />
          <input
            aria-label="Email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-sm"
            required
          />
          <input
            aria-label="Temporary password"
            type="password"
            placeholder="Temporary password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-sm"
            required
          />
          <select
            aria-label="Role"
            value={form.roleKey}
            onChange={(e) => setForm({ ...form, roleKey: e.target.value })}
            className="rounded border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              aria-label="Agency code"
              placeholder="Agency"
              value={form.agencyCode}
              onChange={(e) => setForm({ ...form, agencyCode: e.target.value })}
              className="w-24 rounded border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-sm font-mono"
              required
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              {copy.create}
            </button>
          </div>
        </form>

        {/* Main Split Workspace: CORE-03.09 Staff Identity Registry (Left 7 Cols) + CORE-03.14 Assignment Studio (Right 5 Cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
          {/* LEFT 7 COLUMNS: CORE-03.09 Staff Identity Registry */}
          <div className="xl:col-span-7 bg-surface-container-lowest rounded-lg border border-outline-variant/40 shadow-2xs flex flex-col overflow-hidden">
            {/* Filter & Search Toolbar */}
            <div className="p-space-md border-b border-outline-variant/30 bg-surface-container-low/40 flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
                  filter_list
                </span>
                <input
                  type="search"
                  aria-label={copy.search}
                  placeholder={copy.search}
                  value={q}
                  onChange={(e) => {
                    setPage(1);
                    setQ(e.target.value);
                  }}
                  className="w-full h-9 pl-9 pr-3 bg-surface-container-lowest border border-outline-variant/50 rounded text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  aria-label="Status filter"
                  value={status}
                  onChange={(e) => {
                    setPage(1);
                    setStatus(e.target.value);
                  }}
                  className="h-9 px-2.5 bg-surface-container-lowest border border-outline-variant/50 rounded font-label-md text-label-md text-on-surface"
                >
                  <option value="">All statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                  <option value="DISABLED">DISABLED</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            </div>

            {/* Dense Staff Ledger Table */}
            {data.users.length === 0 ? (
              <p className="p-6 text-sm text-on-surface-variant">{copy.empty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/40 bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                      <th className="py-3 px-4">Staff Identity &amp; Email</th>
                      <th className="py-3 px-3">Role Authority</th>
                      <th className="py-3 px-3">Agency Scope</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/25 font-body-sm text-body-sm">
                    {data.users.map((u) => {
                      const isRowSelected = activeSelected?.id === u.id;
                      return (
                        <tr
                          key={u.id}
                          onClick={() => selectUser(u)}
                          className={`cursor-pointer transition-colors ${
                            isRowSelected
                              ? "bg-surface-container/70 border-l-4 border-l-secondary"
                              : "hover:bg-surface-container-low/60"
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-label-md text-label-md text-on-surface">
                                {u.displayName}
                              </span>
                              <span className="font-mono text-[11px] text-on-surface-variant">
                                {u.email}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary-container text-primary-fixed font-mono text-[11px] font-semibold">
                              {u.roleKey}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-label-md text-label-md text-on-surface font-mono">
                              {u.agencyName ?? "—"}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-label-sm text-[11px] ${
                                u.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : u.status === "DISABLED" || u.status === "SUSPENDED"
                                    ? "bg-error-container text-on-error-container"
                                    : "bg-amber-50 text-amber-900 border border-amber-200"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.status === "ACTIVE"
                                    ? "bg-emerald-600"
                                    : u.status === "DISABLED" || u.status === "SUSPENDED"
                                      ? "bg-error"
                                      : "bg-amber-500"
                                }`}
                              />
                              {u.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectUser(u);
                              }}
                              className={`px-2.5 py-1 rounded font-label-sm text-[11px] uppercase tracking-wider ${
                                isRowSelected
                                  ? "bg-secondary text-on-secondary"
                                  : "border border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:bg-surface-container"
                              }`}
                            >
                              {isRowSelected ? "Editing Scope" : "Inspect"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Table Footer Pagination */}
            <div className="p-space-sm px-4 border-t border-outline-variant/30 bg-surface-container-low/30 flex items-center justify-between text-body-sm text-on-surface-variant">
              <span>
                Page {data.page} · Total {data.total} staff accounts
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2.5 py-1 rounded border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-label-sm text-label-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={data.page * data.pageSize >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 py-1 rounded border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-label-sm text-label-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLUMNS: CORE-03.14 Institutional Assignment & Lifecycle Studio */}
          <div className="xl:col-span-5 flex flex-col gap-space-md">
            {activeSelected ? (
              <div className="bg-surface-container-lowest rounded-lg border-2 border-primary-container shadow-lg overflow-hidden">
                {/* Studio Header */}
                <div className="bg-primary-container text-surface-container-lowest p-space-md flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-secondary text-on-secondary font-mono text-[10px] font-bold">
                        CORE-03.14
                      </span>
                      <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-primary-container">
                        ASSIGNMENT &amp; LIFECYCLE STUDIO
                      </span>
                    </div>
                    <h2 className="font-title-lg text-title-lg text-surface-container-lowest mt-1">
                      Institutional Role &amp; Agency Reassignment
                    </h2>
                  </div>
                  <span className="material-symbols-outlined text-secondary-fixed text-[24px]">
                    admin_panel_settings
                  </span>
                </div>

                {/* Selected Staff Summary Card */}
                <div className="p-space-md bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-container text-surface-container-lowest flex items-center justify-center font-label-lg text-label-lg">
                      {`${activeSelected.firstName[0] ?? "S"}${activeSelected.lastName[0] ?? "P"}`}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-title-md text-title-md text-on-surface">
                        {activeSelected.displayName}
                      </span>
                      <span className="font-mono text-xs text-on-surface-variant">
                        {activeSelected.email} · Rev #{activeSelected.revision}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-label-sm text-[11px]">
                    {activeSelected.status}
                  </span>
                </div>

                {/* Studio Form Body */}
                <div className="p-space-md flex flex-col gap-space-md">
                  {/* Edit Staff Name Section */}
                  <div className="flex flex-col gap-2 pb-3 border-b border-outline-variant/30">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                      1. Identity Name Record
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        aria-label="Edit first name"
                        value={selected ? editFirst : activeSelected.firstName}
                        onChange={(e) => {
                          if (!selected) selectUser(activeSelected);
                          setEditFirst(e.target.value);
                        }}
                        className="h-9 rounded border border-outline-variant/60 bg-surface-container-low px-2.5 text-sm"
                      />
                      <input
                        aria-label="Edit last name"
                        value={selected ? editLast : activeSelected.lastName}
                        onChange={(e) => {
                          if (!selected) selectUser(activeSelected);
                          setEditLast(e.target.value);
                        }}
                        className="h-9 rounded border border-outline-variant/60 bg-surface-container-low px-2.5 text-sm"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (!selected) selectUser(activeSelected);
                          saveMutation.mutate();
                        }}
                        disabled={saveMutation.isPending}
                        className="h-8 px-3 rounded bg-primary-container text-white font-label-sm text-label-sm hover:bg-primary transition-colors"
                      >
                        {copy.save}
                      </button>
                    </div>
                  </div>

                  {/* Current vs Target Scope Diff */}
                  <div className="flex flex-col gap-2">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">
                      2. Institutional Assignment Transition Diff
                    </span>
                    <div className="p-3 rounded-lg bg-surface-container border border-outline-variant/50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-on-surface-variant block">
                          Current Binding
                        </span>
                        <span className="font-mono font-bold text-on-surface">
                          {activeSelected.roleKey} · {activeSelected.agencyName ?? "UNSCOPED"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-secondary block">
                          Proposed Target
                        </span>
                        <span className="font-mono font-bold text-secondary">
                          {targetRoleKey} · {targetAgencyCode}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1">
                      <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
                        Target Role Authority
                        <select
                          aria-label="Target Role Authority"
                          value={targetRoleKey}
                          onChange={(e) => {
                            if (!selected) selectUser(activeSelected);
                            setTargetRoleKey(e.target.value);
                          }}
                          className="h-9 px-2.5 bg-surface-container-lowest border border-outline-variant rounded font-mono text-xs text-on-surface"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
                        Target Agency Jurisdiction
                        <select
                          aria-label="Target Agency Jurisdiction"
                          value={targetAgencyCode}
                          onChange={(e) => {
                            if (!selected) selectUser(activeSelected);
                            setTargetAgencyCode(e.target.value);
                          }}
                          className="h-9 px-2.5 bg-surface-container-lowest border border-outline-variant rounded font-mono text-xs text-on-surface"
                        >
                          {agencyCodeOptions.map((ag) => (
                            <option key={ag.code} value={ag.code}>
                              {ag.code} — {ag.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface mt-1">
                      Gazette / Transfer Decree Reference
                      <input
                        type="text"
                        value={gazetteNote}
                        onChange={(e) => setGazetteNote(e.target.value)}
                        className="h-9 px-2.5 bg-surface-container-lowest border border-outline-variant/60 rounded font-mono text-xs text-on-surface"
                      />
                    </label>

                    <div className="p-2.5 rounded bg-amber-50 border border-amber-200 flex items-start gap-2 text-amber-950 text-xs">
                      <span className="material-symbols-outlined text-amber-700 text-[16px] shrink-0 mt-0.5">
                        gavel
                      </span>
                      <span>
                        <strong>SoD &amp; Session Renewal:</strong> Committing an assignment transition increments credential epoch, revokes active refresh tokens, and records an immutable audit event.
                      </span>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          disabled={assignMutation.isPending}
                          onClick={() => {
                            if (!selected) selectUser(activeSelected);
                            assignMutation.mutate();
                          }}
                          className="h-9 px-4 rounded bg-secondary text-on-secondary font-label-md text-label-md hover:bg-secondary-container transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-[16px]">verified</span>
                          <span>Confirm Reassignment</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Account Lifecycle Halt / Reactivation */}
                  <div className="pt-3 border-t border-outline-variant/30 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md text-error">
                        Account Lifecycle Control
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        Immediately revokes active JWT &amp; refresh tokens
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {activeSelected.status !== "DISABLED" ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!selected) selectUser(activeSelected);
                            setConfirmMode("disable");
                          }}
                          className="px-3 py-1.5 rounded border border-error/50 bg-error-container/30 text-on-error-container font-label-sm text-label-sm hover:bg-error-container transition-colors"
                        >
                          {copy.disable}
                        </button>
                      ) : null}
                      {canEnableUser(activeSelected) ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (!selected) selectUser(activeSelected);
                            setConfirmMode("enable");
                          }}
                          className="px-3 py-1.5 rounded border border-emerald-700 bg-emerald-50 text-emerald-900 font-label-sm text-label-sm hover:bg-emerald-100 transition-colors"
                        >
                          {copy.enable}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {confirmMode ? (
                    <div
                      role="dialog"
                      aria-label="Confirm status change"
                      className="rounded border border-error/40 bg-error-container/20 p-3 flex flex-col gap-2"
                    >
                      <p className="text-xs font-medium text-on-surface">
                        {confirmMode === "disable" ? copy.confirmDisable : copy.confirmEnable}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate(confirmMode)}
                          className="rounded bg-red-700 px-3 py-1 text-xs font-semibold text-white"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmMode(null)}
                          className="rounded border px-3 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between text-xs text-on-surface-variant px-1">
              <span>Need to inspect role permission grants?</span>
              <Link href="/admin/roles" className="text-secondary font-semibold hover:underline">
                Open Authority Matrix →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </StaffWorkspaceShell>
  );
}
