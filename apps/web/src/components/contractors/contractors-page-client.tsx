"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { SRI_LANKA_DISTRICTS } from "@infraos/shared-types";
import { FilterIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { DataTable } from "@/components/data-table/data-table";
import { ContextBar } from "@/components/site-plan/site-plan";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ApiError } from "@/lib/api/client";
import { fetchAgencies } from "@/lib/admin-agencies/api";
import { fetchContractors, fetchSummary } from "@/lib/contractors/api";
import { fill } from "@/lib/contractors/format";
import {
  appliedChips, canHintManage, canHintPerformance, EMPTY_LIST_STATE, parseListParams, removeChip, serializeListParams, withFilter,
  type AppliedChip, type ContractorListState,
} from "@/lib/contractors/list-query";
import { getContractorCopy, type Copy } from "@/lib/contractors/messages";
import { useContractorKeys } from "@/lib/contractors/session";
import { CERT_EXPIRY, CONTRACTOR_CATEGORIES, CONTRACTOR_STATUSES, RISK_BANDS, SORTS, type ContractorStatus, type DirectoryRow } from "@/lib/contractors/types";
import type { TableQueryState } from "@/lib/data-table/query-state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import "@/styles/site-plan-projects.css";
import "@/styles/contractors.css";

import { BandChip, CertChip, EvidenceMeter, Initials, Skeleton, StatusBadge } from "./contractor-badges";
import { AssignDialog, StatusDialog, type StatusTarget } from "./contractor-dialogs";
import { RowActions, type RowIntent } from "./contractor-row-actions";

const narrowQuery = "(max-width: 639px)";
function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(narrowQuery); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(narrowQuery).matches,
    () => false,
  );
}

function chipLabel(chip: AppliedChip, state: ContractorListState, copy: Copy, agencyName: (id: string) => string): string {
  const v = chip.value ?? "";
  switch (chip.kind) {
    case "q": return `“${state.q}”`;
    case "status": return copy.statuses[v as ContractorStatus] ?? v;
    case "category": return copy.categories[v as keyof Copy["categories"]] ?? v;
    case "district": return v;
    case "agencyId": return agencyName(v);
    case "riskBand": return copy.band[v as keyof typeof copy.band] as string;
    case "cert": return v === "expired" ? copy.filters.certExpired : v === "30" ? copy.filters.cert30 : v === "60" ? copy.filters.cert60 : copy.filters.cert90;
    case "hasActive": return v === "yes" ? copy.filters.hasActiveYes : copy.filters.hasActiveNo;
    default: return v;
  }
}

export function ContractorsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const keys = useContractorKeys();
  const [locale] = useWorkspaceLocale();
  const copy = getContractorCopy(locale);
  const narrow = useNarrow();
  const serialized = searchParams.toString();
  const urlState = useMemo(() => parseListParams(new URLSearchParams(serialized)), [serialized]);
  const [state, setState] = useState<ContractorListState>(urlState);
  const [tracked, setTracked] = useState(serialized);
  const [searchDraft, setSearchDraft] = useState(urlState.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [intent, setIntent] = useState<RowIntent | null>(null);
  if (tracked !== serialized) { setTracked(serialized); setState(urlState); setSearchDraft(urlState.q); }

  useEffect(() => {
    const t = window.setTimeout(() => setState((s) => (s.q === searchDraft.trim() ? s : withFilter(s, { q: searchDraft.trim() }))), 300);
    return () => window.clearTimeout(t);
  }, [searchDraft]);
  useEffect(() => {
    const next = serializeListParams(state);
    if (next !== serialized) router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, serialized, state]);

  const canManage = canHintManage(keys.roleKey);
  const request = serializeListParams(state);
  const list = useQuery({ queryKey: keys.key("list", request), queryFn: ({ signal }) => fetchContractors(state, signal), retry: false, placeholderData: (prev) => prev });
  const summary = useQuery({ queryKey: keys.key("summary"), queryFn: () => fetchSummary(), retry: false });
  const agencies = useQuery({ queryKey: keys.key("agencies"), queryFn: () => fetchAgencies({ page: 1 }), enabled: canManage, retry: false, staleTime: 60_000 });
  const agencyList = agencies.data?.agencies ?? [];
  const agencyName = (id: string) => agencyList.find((a) => a.id === id)?.name ?? fill(copy.filters.agencyCurrent, { id: id.slice(-6) });
  const showRisk = Boolean(summary.data?.performance?.available) || canHintPerformance(keys.roleKey);

  const set = (patch: Partial<ContractorListState>) => setState((s) => withFilter(s, patch));
  const clearAll = () => { setSearchDraft(""); setState(EMPTY_LIST_STATE); };
  const chips = appliedChips(state);

  const error = list.error instanceof ApiError ? (list.error.status === 403 ? copy.directory.noPerm : list.error.status === 401 ? copy.common.signedOut : copy.common.unavailable) : list.error ? copy.common.unavailable : undefined;
  const total = list.data?.total ?? 0;
  const rows = list.data?.rows ?? [];
  const scopeChip = list.data ? (list.data.scope === "platform" ? copy.scope.platform : copy.scope.agencies) : null;
  const intentDone = () => setIntent(null);

  const byStatus = (s: string) => summary.data?.byStatus.find((f) => f.value === s)?.count ?? 0;
  const inactiveCount = byStatus("SUSPENDED") + byStatus("INACTIVE");
  const statusIs = (...s: ContractorStatus[]) => state.status.length === s.length && s.every((x) => state.status.includes(x));

  const columns: ColumnDef<DirectoryRow, unknown>[] = [
    {
      id: "name", header: copy.directory.columnName, enableSorting: false,
      cell: ({ row }) => (
        <div className="ctr-table-name">
          <Initials name={row.original.name} />
          <div><Link href={`/contractors/${row.original.id}`}>{row.original.name}</Link><div className="ctr-code ctr-muted">{row.original.registrationNumber}</div></div>
        </div>
      ),
    },
    {
      id: "category", header: copy.directory.columnCategory, enableSorting: false,
      cell: ({ row }) => {
        const specs = row.original.specializations;
        return (
          <div>
            <div>{row.original.category ? copy.categories[row.original.category] : "—"}</div>
            {specs.length ? <div className="ctr-small" title={specs.join(", ")}>{specs.slice(0, 2).join(", ")}{specs.length > 2 ? ` ${fill(copy.directory.moreSpecs, { n: specs.length - 2 })}` : ""}</div> : null}
          </div>
        );
      },
    },
    {
      id: "districts", header: copy.directory.columnDistricts, enableSorting: false,
      cell: ({ row }) => { const d = row.original.operatingDistricts; return d.length ? <span title={d.join(", ")}>{d.slice(0, 2).join(", ")}{d.length > 2 ? ` ${fill(copy.directory.moreDistricts, { n: d.length - 2 })}` : ""}</span> : "—"; },
    },
    { id: "status", header: copy.directory.columnStatus, enableSorting: false, cell: ({ row }) => <StatusBadge status={row.original.status} copy={copy} /> },
    { id: "active", header: copy.directory.columnActive, enableSorting: false, cell: ({ row }) => <span className="ctr-num">{row.original.activeProjects}</span> },
    { id: "certs", header: copy.directory.columnCerts, enableSorting: false, cell: ({ row }) => <CertChip counts={row.original.certifications} copy={copy} /> },
    ...(showRisk ? [
      { id: "evidence", header: copy.directory.columnEvidence, enableSorting: false, cell: ({ row }) => <EvidenceMeter level={row.original.evidenceLevel} copy={copy} /> } as ColumnDef<DirectoryRow, unknown>,
      { id: "band", header: copy.directory.columnBand, enableSorting: false, cell: ({ row }) => <BandChip band={row.original.reliabilityBand} copy={copy} /> } as ColumnDef<DirectoryRow, unknown>,
    ] : []),
    { id: "actions", header: () => <span className="ctr-sr">{copy.common.actions}</span>, enableSorting: false, cell: ({ row }) => <RowActions row={row.original} copy={copy} roleKey={keys.roleKey} onIntent={setIntent} /> },
  ];

  const tableQuery: TableQueryState = { pageIndex: Math.max(0, state.page - 1), pageSize: state.limit, sorting: [], filters: [], search: state.q };

  const filterBar = (
    <form className="sp-surface ctr-filters" aria-label={copy.filters.label} onSubmit={(e) => e.preventDefault()}>
      <div className="ctr-filter-row">
        <div className="ctr-field is-wide">
          <label htmlFor="ctr-q">{copy.filters.search}</label>
          <input id="ctr-q" className="ctr-input" value={searchDraft} maxLength={100} onChange={(e) => setSearchDraft(e.target.value)} />
        </div>
        <div className="ctr-field">
          <label htmlFor="ctr-category">{copy.filters.category}</label>
          <select id="ctr-category" className="ctr-input" value={state.category} onChange={(e) => set({ category: e.target.value as ContractorListState["category"] })}>
            <option value="">{copy.common.any}</option>
            {CONTRACTOR_CATEGORIES.map((c) => <option key={c} value={c}>{copy.categories[c]}</option>)}
          </select>
        </div>
        <div className="ctr-field">
          <label htmlFor="ctr-district">{copy.filters.district}</label>
          <input id="ctr-district" className="ctr-input" list="ctr-districts" value={state.district} placeholder={copy.filters.districtAll} maxLength={40}
            onChange={(e) => { const v = e.target.value; if (v === "" || SRI_LANKA_DISTRICTS.includes(v)) set({ district: v }); else setState((s) => ({ ...s, district: v })); }} />
          <datalist id="ctr-districts">{SRI_LANKA_DISTRICTS.map((d) => <option key={d} value={d} />)}</datalist>
        </div>
      </div>
      <div className="ctr-filter-row">
        <div className="ctr-field" role="group" aria-label={copy.filters.status} style={{ flex: "2 1 18rem" }}>
          <span className="ctr-label">{copy.filters.status}</span>
          <div className="ctr-chips">
            {CONTRACTOR_STATUSES.map((s) => (
              <button key={s} type="button" className="ctr-chip-btn" aria-pressed={state.status.includes(s)} onClick={() => set({ status: state.status.includes(s) ? state.status.filter((x) => x !== s) : [...state.status, s] })}>{copy.statuses[s]}</button>
            ))}
          </div>
        </div>
        {canManage ? (
          <div className="ctr-field">
            <label htmlFor="ctr-agency">{copy.filters.agency}</label>
            <select id="ctr-agency" className="ctr-input" value={state.agencyId} onChange={(e) => set({ agencyId: e.target.value })}>
              <option value="">{copy.common.any}</option>
              {state.agencyId && !agencyList.some((a) => a.id === state.agencyId) ? <option value={state.agencyId}>{agencyName(state.agencyId)}</option> : null}
              {agencyList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        ) : null}
        <div className="ctr-field">
          <label htmlFor="ctr-active">{copy.filters.hasActive}</label>
          <select id="ctr-active" className="ctr-input" value={state.hasActive} onChange={(e) => set({ hasActive: e.target.value as ContractorListState["hasActive"] })}>
            <option value="">{copy.common.any}</option>
            <option value="yes">{copy.filters.hasActiveYes}</option>
            <option value="no">{copy.filters.hasActiveNo}</option>
          </select>
        </div>
        <div className="ctr-field">
          <label htmlFor="ctr-cert">{copy.filters.certExpiry}</label>
          <select id="ctr-cert" className="ctr-input" value={state.cert} onChange={(e) => set({ cert: e.target.value as ContractorListState["cert"] })}>
            <option value="">{copy.common.any}</option>
            {CERT_EXPIRY.map((c) => <option key={c} value={c}>{c === "expired" ? copy.filters.certExpired : c === "30" ? copy.filters.cert30 : c === "60" ? copy.filters.cert60 : copy.filters.cert90}</option>)}
          </select>
        </div>
        {showRisk ? (
          <div className="ctr-field">
            <label htmlFor="ctr-risk">{copy.filters.riskBand}</label>
            <select id="ctr-risk" className="ctr-input" value={state.riskBand} onChange={(e) => set({ riskBand: e.target.value as ContractorListState["riskBand"] })}>
              <option value="">{copy.common.any}</option>
              {RISK_BANDS.map((b) => <option key={b} value={b}>{copy.band[b]}</option>)}
            </select>
          </div>
        ) : null}
        <div className="ctr-field">
          <label htmlFor="ctr-sort">{copy.filters.sort}</label>
          <select id="ctr-sort" className="ctr-input" value={state.sort} onChange={(e) => setState((s) => ({ ...s, sort: e.target.value as ContractorListState["sort"], page: 1 }))}>
            {SORTS.filter((s) => s !== "risk" || showRisk).map((s) => <option key={s} value={s}>{s === "name" ? copy.filters.sortName : s === "registeredAt" ? copy.filters.sortRegistered : s === "activeProjects" ? copy.filters.sortActive : copy.filters.sortRisk}</option>)}
          </select>
        </div>
      </div>
    </form>
  );

  const statusTarget: StatusTarget | null = intent?.kind === "status" ? intent.target : null;
  const countText = !list.isLoading && !error ? (total === 1 ? copy.directory.countOne : fill(copy.directory.count, { n: total })) : " ";

  return (
    <StaffWorkspaceShell
      title={copy.title}
      description={copy.subtitle}
      wide
      context={
        <ContextBar
          crumbs={[{ label: copy.breadcrumbWorkspace, href: "/dashboard" }, { label: copy.title }]}
          scope={scopeChip}
          actions={canManage ? <Link className="ctr-btn is-primary" href="/contractors/new"><PlusIcon aria-hidden="true" />{copy.register}</Link> : null}
        />
      }
    >
      <div className="ctr">
        {locale !== "en" ? <p className="ctr-small">{copy.nativeReview}</p> : null}

        <section className="ctr-strip" aria-label={copy.title}>
          {summary.isLoading ? [0, 1, 2, 3].map((i) => <div key={i} className="ctr-card" aria-hidden="true"><Skeleton height="1rem" width="60%" /><Skeleton height="1.75rem" width="40%" /></div>) : (
            <>
              <button type="button" className="ctr-card" aria-pressed={statusIs("ACTIVE")} onClick={() => set({ status: statusIs("ACTIVE") ? [] : ["ACTIVE"] })}>
                <span className="ctr-card-label">{copy.insight.active}</span><span className="ctr-card-value">{summary.data ? byStatus("ACTIVE") : "—"}</span>
                <span className="ctr-card-hint">{summary.data ? fill(copy.insight.withoutEvidence, { n: summary.data.withoutEvidence }) : copy.common.unavailable}</span>
              </button>
              <button type="button" className="ctr-card" aria-pressed={statusIs("SUSPENDED", "INACTIVE")} onClick={() => set({ status: statusIs("SUSPENDED", "INACTIVE") ? [] : ["SUSPENDED", "INACTIVE"] })}>
                <span className="ctr-card-label">{copy.insight.inactive}</span><span className="ctr-card-value">{summary.data ? inactiveCount : "—"}</span>
                <span className="ctr-card-hint">{copy.insight.applyFilter}</span>
              </button>
              <button type="button" className="ctr-card" aria-pressed={state.cert === "30" || state.cert === "expired"} onClick={() => set({ cert: state.cert ? "" : (summary.data?.certifications.expiring30d ?? 0) > 0 ? "30" : "expired" })}>
                <span className="ctr-card-label">{copy.insight.certs}</span>
                <span className="ctr-card-value">{summary.data ? summary.data.certifications.expiring30d + summary.data.certifications.expired : "—"}</span>
                <span className="ctr-card-hint">{summary.data ? fill(copy.insight.certsHint, { a: summary.data.certifications.expiring30d, b: summary.data.certifications.expired }) : ""}</span>
              </button>
              {summary.data?.performance?.available ? (
                <button type="button" className="ctr-card" aria-pressed={state.sort === "risk"} onClick={() => setState((s) => ({ ...s, sort: s.sort === "risk" ? "name" : "risk", page: 1 }))}>
                  <span className="ctr-card-label">{copy.insight.attention}</span><span className="ctr-card-value">{summary.data.performance.attentionCount ?? 0}</span>
                  <span className="ctr-card-hint">{summary.data.performance.truncated ? fill(copy.insight.truncatedHint, { n: summary.data.performance.evaluated ?? 0 }) : copy.insight.attentionHint}</span>
                </button>
              ) : null}
            </>
          )}
        </section>

        {narrow ? (
          <>
            <div className="ctr-bar">
              <button type="button" className="ctr-btn" onClick={() => setFiltersOpen(true)}><FilterIcon aria-hidden="true" />{copy.filters.filters}{chips.length ? ` (${chips.length})` : ""}</button>
              <p className="ctr-small" role="status" aria-live="polite">{countText}</p>
            </div>
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                <SheetHeader><SheetTitle>{copy.filters.filters}</SheetTitle><SheetDescription>{copy.filters.label}</SheetDescription></SheetHeader>
                <div className="ctr" style={{ padding: "0 1rem 1rem" }}>
                  {filterBar}
                  <button type="button" className="ctr-btn is-primary" onClick={() => setFiltersOpen(false)}>{copy.common.close}</button>
                </div>
              </SheetContent>
            </Sheet>
          </>
        ) : filterBar}

        {chips.length ? (
          <div className="ctr-chips" aria-label={copy.filters.applied}>
            {chips.map((chip) => {
              const label = chipLabel(chip, state, copy, agencyName);
              return (
                <button key={chip.key} type="button" className="ctr-chip-btn is-applied" aria-label={fill(copy.filters.removeFilter, { name: label })} onClick={() => { if (chip.kind === "q") setSearchDraft(""); setState((s) => removeChip(s, chip)); }}>
                  {label}<XIcon aria-hidden="true" />
                </button>
              );
            })}
            <button type="button" className="ctr-btn is-ghost" onClick={clearAll}>{copy.common.clearAll}</button>
          </div>
        ) : null}

        {!narrow ? <p className="ctr-small" role="status" aria-live="polite">{countText}</p> : null}

        {narrow ? (
          <div className="ctr-cards" aria-label={copy.directory.cardList}>
            {list.isLoading ? [0, 1, 2].map((i) => <div key={i} className="ctr-mcard" aria-hidden="true"><Skeleton height="2.5rem" /></div>) : null}
            {error ? <div className="ctr-mcard" role="alert"><p className="ctr-error">{error}</p><button type="button" className="ctr-btn" onClick={() => void list.refetch()}>{copy.common.retry}</button></div> : null}
            {rows.map((row) => (
              <article key={row.id} className="ctr-mcard">
                <div className="ctr-mcard-top">
                  <Initials name={row.name} />
                  <div><Link href={`/contractors/${row.id}`} className="ctr-wrap" style={{ fontWeight: 700, color: "inherit" }}>{row.name}</Link><div className="ctr-code ctr-muted">{row.registrationNumber}</div></div>
                  <RowActions row={row} copy={copy} roleKey={keys.roleKey} onIntent={setIntent} />
                </div>
                <div className="ctr-row"><StatusBadge status={row.status} copy={copy} /><CertChip counts={row.certifications} copy={copy} />{row.category ? <span className="ctr-tag">{copy.categories[row.category]}</span> : null}</div>
                {showRisk ? <div className="ctr-row"><BandChip band={row.reliabilityBand} copy={copy} /><EvidenceMeter level={row.evidenceLevel} copy={copy} /></div> : null}
              </article>
            ))}
            {!list.isLoading && !error && total > state.limit ? (
              <div className="ctr-row" style={{ justifyContent: "space-between" }}>
                <button type="button" className="ctr-btn" disabled={state.page <= 1} onClick={() => setState((s) => ({ ...s, page: s.page - 1 }))}>{copy.common.previous}</button>
                <span className="ctr-small">{copy.common.page} {state.page} {copy.common.of} {Math.max(1, Math.ceil(total / state.limit))}</span>
                <button type="button" className="ctr-btn" disabled={state.page * state.limit >= total} onClick={() => setState((s) => ({ ...s, page: s.page + 1 }))}>{copy.common.next}</button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="admin-users-table-wrap">
            <DataTable
              columns={columns}
              data={rows}
              getRowId={(row) => row.id}
              mode="server"
              density="comfortable"
              loading={list.isLoading}
              error={error}
              onRetry={() => void list.refetch()}
              pageSizeOptions={[10, 20, 50]}
              tableLabel={copy.title}
              server={{
                query: tableQuery, totalCount: total,
                onQueryChange: (next) => setState((s) => ({ ...s, page: next.pageIndex + 1, limit: next.pageSize === 10 || next.pageSize === 50 ? next.pageSize : 20 })),
              }}
            />
          </div>
        )}

        {!list.isLoading && !error && total === 0 ? (
          <div className="sp-surface ctr-panel" role="status">
            <p>{chips.length ? copy.directory.noMatch : copy.directory.empty}</p>
            <div className="ctr-row">
              {chips.length ? <button type="button" className="ctr-btn" onClick={clearAll}>{copy.common.clearAll}</button> : null}
              {canManage ? <Link className="ctr-btn is-primary" href="/contractors/new">{copy.register}</Link> : null}
            </div>
          </div>
        ) : null}
        {canManage && narrow ? <Link className="ctr-btn is-primary ctr-fab" href="/contractors/new"><PlusIcon aria-hidden="true" />{copy.directory.registerShort}</Link> : null}
      </div>

      {intent?.kind === "status" && statusTarget ? (
        <StatusDialog open onOpenChange={(o) => { if (!o) intentDone(); }} copy={copy} locale={locale} contractor={{ id: intent.row.id, name: intent.row.name }} target={statusTarget} />
      ) : null}
      {intent?.kind === "assign" ? (
        <AssignDialog open onOpenChange={(o) => { if (!o) intentDone(); }} copy={copy} locale={locale} contractor={{ id: intent.row.id, name: intent.row.name }} />
      ) : null}
    </StaffWorkspaceShell>
  );
}

