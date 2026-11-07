"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon, MoreHorizontalIcon, PlusIcon, RefreshCwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { downloadAssetsCsv, fetchAssets, fetchAssetSummary } from "@/lib/assets/api";
import { getAssetCopy, type Copy } from "@/lib/assets/messages";
import { hintConvert, useAssetKeys } from "@/lib/assets/session";
import { ASSET_CONDITIONS, ASSET_TYPES, HEALTH_BANDS, OPERATIONAL_STATUSES, type AssetRow, type AssetSummary } from "@/lib/assets/types";
import { activeAssetFilterCount, assetApiQuery, assetParams, DEFAULT_ASSET_FILTERS, fill, fmtDate, fmtMonth, parseAssetFilters, SORTS, type AssetFilters } from "@/lib/assets/view";
import type { AuthLocale } from "@/lib/auth/types";
import { useUrlParams } from "@/lib/finance/url-state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";

import { BarList, BasisChip, ConditionChip, ConditionDonut, EmptyState, errorText, ErrorState, Field, HealthCell, OpStatusChip, Skeletons } from "./asset-ui";

const PAGE = 20;
type Common = { copy: Copy; locale: AuthLocale };

function Kpi({ label, value, hint, onClick, href }: { label: string; value: number | null | undefined; hint: string; onClick?: () => void; href?: string }) {
  const inner = <><span className="ctr-card-label">{label}</span><span className="ctr-card-value">{value ?? "—"}</span><span className="ctr-card-hint">{hint}</span></>;
  return href ? <Link href={href} className="ctr-card" style={{ textDecoration: "none" }} aria-label={`${label}: ${value ?? "—"}. ${hint}`}>{inner}</Link>
    : <button type="button" className="ctr-card" onClick={onClick} aria-label={`${label}: ${value ?? "—"}. ${hint}`}>{inner}</button>;
}

function RowMenu({ row, copy }: { row: AssetRow; copy: Copy }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  const dead = row.operationalStatus === "DECOMMISSIONED";
  return (
    <div className="ins-menu" ref={ref}>
      <button type="button" className="ctr-btn is-ghost" aria-haspopup="menu" aria-expanded={open} aria-label={`${copy.dashboard.table.rowMenu}: ${row.assetNo ?? row.name}`} onClick={() => setOpen(!open)}><MoreHorizontalIcon aria-hidden="true" /></button>
      {open ? (
        <div className="ins-menu-list" role="menu">
          <Link role="menuitem" className="ctr-btn is-ghost" href={`/assets/${row.id}`} style={{ justifyContent: "flex-start" }}>{copy.dashboard.rowMenu.open}</Link>
          {!dead ? <Link role="menuitem" className="ctr-btn is-ghost" href={`/assets/${row.id}?action=maintenance`} style={{ justifyContent: "flex-start" }}>{copy.dashboard.rowMenu.requestMaintenance}</Link> : null}
          {!dead ? <Link role="menuitem" className="ctr-btn is-ghost" href={`/assets/${row.id}?action=assessment`} style={{ justifyContent: "flex-start" }}>{copy.dashboard.rowMenu.recordAssessment}</Link> : null}
        </div>
      ) : null}
    </div>
  );
}

function AssetTable({ rows, copy, locale }: Common & { rows: AssetRow[] }) {
  const dueText = (r: AssetRow) => <>{fmtDate(r.nextAssessmentDue, locale)}{r.assessmentOverdue ? <> <span className="ins-prio" data-p="HIGH">{copy.dashboard.assessmentOverdue}</span></> : null}</>;
  return (
    <>
      <div className="ins-only-wide" style={{ overflowX: "auto" }}>
        <table className="ins-table">
          <thead><tr>{[copy.dashboard.table.asset, copy.dashboard.table.owner, copy.dashboard.table.condition, copy.dashboard.table.health, copy.dashboard.table.status, copy.dashboard.table.nextAssessment, copy.dashboard.table.nextMaintenance].map((h) => <th key={h} scope="col">{h}</th>)}<th scope="col"><span className="sr-only">{copy.dashboard.table.actions}</span></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link className="ins-link" href={`/assets/${r.id}`}>{r.name}</Link><br /><span className="ins-muted">{r.assetNo ?? "—"} · {copy.assetType[r.assetType]}</span></td>
                <td>{r.agencyName ?? "—"}<br /><span className="ins-muted">{r.district ?? ""}</span></td>
                <td><ConditionChip value={r.condition} copy={copy} /><br /><BasisChip basis={r.conditionBasis} copy={copy} short /></td>
                <td><HealthCell score={r.healthScore} legacy={r.healthLegacy} copy={copy} /></td>
                <td><OpStatusChip status={r.operationalStatus} copy={copy} /></td>
                <td>{dueText(r)}</td>
                <td>{r.nextMaintenanceAt ? fmtDate(r.nextMaintenanceAt, locale) : "—"}</td>
                <td><RowMenu row={r} copy={copy} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ins-cards ins-only-narrow">
        {rows.map((r) => (
          <div key={r.id} className="ins-card" data-overdue={r.assessmentOverdue}>
            <div className="ins-card-top"><div><Link className="ins-link" href={`/assets/${r.id}`}>{r.name}</Link><br /><span className="ins-muted">{r.assetNo ?? "—"} · {copy.assetType[r.assetType]} · {r.agencyName ?? ""}</span></div><RowMenu row={r} copy={copy} /></div>
            <div className="ctr-row"><ConditionChip value={r.condition} copy={copy} /><OpStatusChip status={r.operationalStatus} copy={copy} /></div>
            <span className="ins-muted">{copy.dashboard.table.health}: {r.healthScore ?? "—"} · {copy.dashboard.table.nextAssessment}: {fmtDate(r.nextAssessmentDue, locale)}{r.assessmentOverdue ? ` (${copy.dashboard.assessmentOverdue})` : ""}</span>
            <Link className="ctr-btn" href={`/assets/${r.id}`}>{copy.common.open}</Link>
          </div>
        ))}
      </div>
    </>
  );
}

function Insight({ summary, copy, locale }: Common & { summary: AssetSummary }) {
  const h = summary.health;
  const ch = copy.dashboard.charts;
  const bandRows = !("restricted" in h) ? (["GOOD", "WATCH", "POOR", "CRITICAL"] as const).map((b) => ({ label: copy.band[b], n: h.distribution[b] ?? 0, color: b === "GOOD" ? "#1f7a4c" : b === "WATCH" ? "#e08a1e" : b === "POOR" ? "#b8482f" : "#7a1f2b" })) : [];
  const maxW = Math.max(1, ...summary.workload.flatMap((w) => [w.planned, w.completed]));
  return (
    <section className="ast-three" aria-label={copy.dashboard.title}>
      <div className="ins-panel"><h2 className="ins-h">{ch.condition}</h2>{summary.total ? <ConditionDonut counts={summary.byCondition} copy={copy} /> : <p className="ins-muted">{copy.common.empty}</p>}</div>
      <div className="ins-panel">
        <h2 className="ins-h">{ch.workload}</h2>
        {summary.workload.every((w) => w.planned === 0 && w.completed === 0) ? <p className="ins-muted">{ch.noWorkload}</p> : (
          <>
            <div className="ast-workload" role="img" aria-label={ch.workload}>
              {summary.workload.map((w) => (
                <div key={w.month}><div className="stack"><i style={{ height: `${(w.planned / maxW) * 100}%`, background: "var(--infra-orange)" }} /><i style={{ height: `${(w.completed / maxW) * 100}%`, background: "var(--infra-green)" }} /></div><span>{fmtMonth(new Date(`${w.month}-01T00:00:00Z`), locale).split(" ")[0]}</span></div>
              ))}
            </div>
            <ul className="ast-legend"><li><i style={{ background: "var(--infra-orange)" }} />{ch.planned}</li><li><i style={{ background: "var(--infra-green)" }} />{ch.completed}</li></ul>
          </>
        )}
      </div>
      <div className="ins-panel">
        <h2 className="ins-h">{ch.healthDistribution}</h2>
        {"restricted" in h ? <p className="ins-muted">{ch.restrictedHealth}</p> : h.available === 0 ? <p className="ins-muted">{ch.noHealth}</p> : <><BarList rows={bandRows} /><p className="ins-muted">{fill(ch.coverage, { n: h.available, m: h.total })}</p></>}
      </div>
    </section>
  );
}

export function AssetsDashboard() {
  const [locale] = useWorkspaceLocale();
  const copy = getAssetCopy(locale);
  const router = useRouter();
  const { roleKey, key } = useAssetKeys();
  const url = useUrlParams();
  const filters = useMemo(() => parseAssetFilters((k) => url.get(k) || null), [url]);
  const [search, setSearch] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(false);

  const go = (f: AssetFilters) => { const p = assetParams(f); router.replace(p.toString() ? `/assets?${p.toString()}` : "/assets", { scroll: false }); };
  const setFilters = (patch: Partial<AssetFilters>) => go({ ...filters, ...patch, ...("page" in patch ? {} : { page: 1 }) });
  useEffect(() => { const t = setTimeout(() => { if (search.trim() !== filters.q) setFilters({ q: search.trim() }); }, 350); return () => clearTimeout(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const summary = useQuery({ queryKey: key("summary"), queryFn: ({ signal }) => fetchAssetSummary(signal), staleTime: 30_000 });
  const list = useQuery({ queryKey: key("list", JSON.stringify(filters)), queryFn: ({ signal }) => fetchAssets(assetApiQuery(filters, PAGE), signal), placeholderData: keepPreviousData });
  const exportCsv = useMutation({ mutationFn: () => downloadAssetsCsv(assetApiQuery({ ...filters, page: 1 })), onSuccess: (n) => toast.success(fill(copy.dashboard.exported, { n })), onError: (e) => toast.error(errorText(e, copy)) });

  const s = summary.data;
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const chips: { label: string; clear: () => void }[] = [
    ...(filters.q ? [{ label: `“${filters.q}”`, clear: () => { setSearch(""); setFilters({ q: "" }); } }] : []),
    ...(filters.assetType ? [{ label: copy.assetType[filters.assetType as keyof typeof copy.assetType] ?? filters.assetType, clear: () => setFilters({ assetType: "" }) }] : []),
    ...(filters.condition ? [{ label: copy.condition[filters.condition as keyof typeof copy.condition] ?? filters.condition, clear: () => setFilters({ condition: "" }) }] : []),
    ...(filters.operationalStatus ? [{ label: copy.opStatus[filters.operationalStatus as keyof typeof copy.opStatus] ?? filters.operationalStatus, clear: () => setFilters({ operationalStatus: "" }) }] : []),
    ...(filters.healthBand ? [{ label: `${copy.dashboard.filters.healthBand}: ${copy.band[filters.healthBand as keyof typeof copy.band] ?? copy.dashboard.filters.noHealth}`, clear: () => setFilters({ healthBand: "" }) }] : []),
    ...(filters.district ? [{ label: filters.district, clear: () => setFilters({ district: "" }) }] : []),
    ...(filters.projectId ? [{ label: copy.common.project, clear: () => setFilters({ projectId: "" }) }] : []),
    ...(filters.attention ? [{ label: copy.dashboard.filters.attention, clear: () => setFilters({ attention: false }) }] : []),
    ...(filters.dlp ? [{ label: copy.dashboard.filters.dlp, clear: () => setFilters({ dlp: false }) }] : []),
    ...(filters.hasOpenMaintenance ? [{ label: copy.dashboard.filters.openMaintenance, clear: () => setFilters({ hasOpenMaintenance: false }) }] : []),
  ];
  const canConvert = hintConvert(roleKey);
  const k = copy.dashboard.kpi;

  return (
    <StaffWorkspaceShell title={copy.dashboard.title} description={copy.dashboard.description} wide
      context={<ContextBar crumbs={[{ label: copy.nav.assets }]} scope={copy.dashboard.scope} asOf={null} actions={<div className="ctr-row">
        <button type="button" className="ctr-btn" onClick={() => { void summary.refetch(); void list.refetch(); }}><RefreshCwIcon aria-hidden="true" />{copy.common.refresh}</button>
        <button type="button" className="ctr-btn" disabled={exportCsv.isPending || !total} onClick={() => exportCsv.mutate()}><DownloadIcon aria-hidden="true" />{copy.dashboard.export}</button>
        {canConvert ? <Link className="ctr-btn is-primary" href="/assets/convert"><PlusIcon aria-hidden="true" />{copy.dashboard.convert}</Link> : null}
      </div>} />}>
      <div className="ins ast">
        <section className="ins-strip" aria-label={k.hint}>
          <Kpi label={k.total} value={s?.total} hint={k.hint} onClick={() => go(DEFAULT_ASSET_FILTERS)} />
          <Kpi label={k.attention} value={s?.attention} hint={k.hint} onClick={() => go({ ...DEFAULT_ASSET_FILTERS, attention: true })} />
          <Kpi label={k.assessments} value={s ? s.assessments.overdue + s.assessments.dueSoon : undefined} hint={k.hint} onClick={() => go({ ...DEFAULT_ASSET_FILTERS, attention: true })} />
          <Kpi label={k.overdueMaintenance} value={s?.maintenance.overdue} hint={k.hint} href="/maintenance?overdue=true" />
          <Kpi label={k.openRequests} value={s?.maintenance.openRequests} hint={k.hint} href="/maintenance?status=REQUESTED" />
          {s && s.pendingConversions !== null ? <Kpi label={k.pendingConversions} value={s.pendingConversions} hint={k.hint} href="/assets/conversions" /> : null}
        </section>

        {summary.isPending ? <Skeletons n={1} /> : summary.isError ? <ErrorState error={summary.error} copy={copy} onRetry={() => void summary.refetch()} /> : <Insight summary={summary.data} copy={copy} locale={locale} />}

        <section className="ins-panel" aria-label={copy.dashboard.attentionTitle}>
          <h2 className="ins-h">{copy.dashboard.attentionTitle}</h2>
          {!s ? null : s.attentionList.length === 0 ? <p className="ins-muted">{copy.dashboard.attentionNone}</p> : (
            <div className="ins-cards">{s.attentionList.map((r) => (
              <div key={r.id} className="ins-card" data-overdue={r.assessmentOverdue}>
                <div className="ins-card-top"><div><Link className="ins-link" href={`/assets/${r.id}`}>{r.name}</Link><br /><span className="ins-muted">{r.assetNo ?? "—"} · {r.agencyName ?? ""}</span></div><ConditionChip value={r.condition} copy={copy} /></div>
                <span className="ins-muted">{r.attention.map((a) => (copy.dashboard.reasons as Record<string, string>)[a] ?? a).join(" · ")}</span>
              </div>
            ))}</div>
          )}
        </section>

        <div className="ins-bar">
          <button type="button" className="ctr-btn" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>{copy.dashboard.filters.toggle}{activeAssetFilterCount(filters) ? ` (${activeAssetFilterCount(filters)})` : ""}</button>
          <button type="button" className="ctr-btn is-ghost" onClick={() => { setSearch(""); go(DEFAULT_ASSET_FILTERS); }}>{copy.dashboard.filters.reset}</button>
        </div>
        <div className="ins-panel" hidden={!showFilters && !chips.length}>
          <div className="ins-filters" hidden={!showFilters}>
            <Field label={copy.common.search} wide>{(id) => <input id={id} type="search" className="ctr-input" placeholder={copy.dashboard.filters.search} value={search} onChange={(e) => setSearch(e.target.value)} />}</Field>
            <Field label={copy.dashboard.filters.type}>{(id) => <select id={id} className="ctr-input" value={filters.assetType} onChange={(e) => setFilters({ assetType: e.target.value })}><option value="">{copy.dashboard.filters.anyType}</option>{ASSET_TYPES.map((t) => <option key={t} value={t}>{copy.assetType[t]}</option>)}</select>}</Field>
            <Field label={copy.dashboard.filters.condition}>{(id) => <select id={id} className="ctr-input" value={filters.condition} onChange={(e) => setFilters({ condition: e.target.value })}><option value="">{copy.common.all}</option>{ASSET_CONDITIONS.map((t) => <option key={t} value={t}>{copy.condition[t]}</option>)}</select>}</Field>
            <Field label={copy.dashboard.filters.status}>{(id) => <select id={id} className="ctr-input" value={filters.operationalStatus} onChange={(e) => setFilters({ operationalStatus: e.target.value })}><option value="">{copy.common.all}</option>{OPERATIONAL_STATUSES.map((t) => <option key={t} value={t}>{copy.opStatus[t]}</option>)}</select>}</Field>
            <Field label={copy.dashboard.filters.healthBand}>{(id) => <select id={id} className="ctr-input" value={filters.healthBand} onChange={(e) => setFilters({ healthBand: e.target.value })}><option value="">{copy.common.all}</option>{HEALTH_BANDS.map((t) => <option key={t} value={t}>{copy.band[t]}</option>)}<option value="NONE">{copy.dashboard.filters.noHealth}</option></select>}</Field>
            <Field label={copy.dashboard.filters.district}>{(id) => <input id={id} className="ctr-input" value={filters.district} onChange={(e) => setFilters({ district: e.target.value })} />}</Field>
            <Field label={copy.dashboard.filters.sort}>{(id) => <select id={id} className="ctr-input" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>{SORTS.map((t) => <option key={t} value={t}>{copy.dashboard.filters.sorts[t]}</option>)}</select>}</Field>
            <label className="ins-toggle"><input type="checkbox" checked={filters.attention} onChange={(e) => setFilters({ attention: e.target.checked })} />{copy.dashboard.filters.attention}</label>
            <label className="ins-toggle"><input type="checkbox" checked={filters.dlp} onChange={(e) => setFilters({ dlp: e.target.checked })} />{copy.dashboard.filters.dlp}</label>
            <label className="ins-toggle"><input type="checkbox" checked={filters.hasOpenMaintenance} onChange={(e) => setFilters({ hasOpenMaintenance: e.target.checked })} />{copy.dashboard.filters.openMaintenance}</label>
          </div>
          {chips.length ? <div className="ins-chips" aria-label={copy.dashboard.filters.applied}>{chips.map((ch, i) => <span key={i} className="ins-chip">{ch.label}<button type="button" onClick={ch.clear} aria-label={`${copy.common.clear}: ${ch.label}`}><XIcon aria-hidden="true" /></button></span>)}</div> : null}
        </div>

        {list.isPending ? <Skeletons /> : list.isError ? <ErrorState error={list.error} copy={copy} onRetry={() => void list.refetch()} /> : list.data.rows.length === 0 ? (
          <EmptyState title={copy.dashboard.empty.title} body={activeAssetFilterCount(filters) ? copy.dashboard.empty.body : copy.dashboard.empty.unfiltered}
            action={canConvert ? <Link className="ctr-btn is-primary" href="/assets/convert">{copy.dashboard.convert}</Link> : undefined} />
        ) : (
          <>
            <AssetTable rows={list.data.rows} copy={copy} locale={locale} />
            <nav className="ins-pager" aria-label={fill(copy.common.page, { n: filters.page, total: pages })}>
              <span className="ins-muted">{fill(copy.common.total, { n: total })}</span>
              <span className="ctr-row">
                <button type="button" className="ctr-btn" disabled={filters.page <= 1} onClick={() => setFilters({ page: filters.page - 1 })}>{copy.common.prev}</button>
                <span>{fill(copy.common.page, { n: filters.page, total: pages })}</span>
                <button type="button" className="ctr-btn" disabled={filters.page >= pages} onClick={() => setFilters({ page: filters.page + 1 })}>{copy.common.next}</button>
              </span>
            </nav>
          </>
        )}
        <p className="ins-muted">{copy.common.syntheticNote}</p>
      </div>
    </StaffWorkspaceShell>
  );
}
