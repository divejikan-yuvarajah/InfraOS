"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { PlusIcon, RefreshCwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { fetchMaintCalendar, fetchMaintenance, fetchMaintSummary, patchMaintenance } from "@/lib/assets/api";
import { getAssetCopy, type Copy } from "@/lib/assets/messages";
import { useAssetKeys } from "@/lib/assets/session";
import { MAINTENANCE_PRIORITIES, MAINTENANCE_STATUSES, MAINTENANCE_TYPES, type MaintDetail, type MaintRow } from "@/lib/assets/types";
import { activeMaintFilterCount, DEFAULT_MAINT_FILTERS, fill, fmtDate, maintApiQuery, maintParams, money, parseMaintFilters, type MaintFilters } from "@/lib/assets/view";
import type { AuthLocale } from "@/lib/auth/types";
import { useUrlParams } from "@/lib/finance/url-state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { addDays, colomboToIso, dayKey, isoToColomboParts, windowFor, type CalendarView } from "@/lib/inspections/calendar-math";

import { RequestMaintenanceDialog, useRefreshAssets } from "./asset-dialogs";
import { EmptyState, errorText, ErrorState, Field, MaintStatusChip, PriorityChip, Shell, Skeletons } from "./asset-ui";
import { ActionDialog, MaintCalendar, MaintDrawer, MaintStepper, type Act } from "./maintenance-parts";

const PAGE = 20;
type Tab = "queue" | "calendar" | "mine";
type Common = { copy: Copy; locale: AuthLocale };

function Kpi({ label, value, hint, onClick }: { label: string; value: number | undefined; hint: string; onClick: () => void }) {
  return <button type="button" className="ctr-card" onClick={onClick} aria-label={`${label}: ${value ?? "—"}. ${hint}`}><span className="ctr-card-label">{label}</span><span className="ctr-card-value">{value ?? "—"}</span><span className="ctr-card-hint">{hint}</span></button>;
}

function EditMaintDialog({ detail, copy, onClose }: { detail: MaintDetail; copy: Copy; onClose: () => void }) {
  const refresh = useRefreshAssets();
  const [title, setTitle] = useState(detail.title ?? "");
  const [description, setDescription] = useState(detail.description ?? "");
  const [priority, setPriority] = useState(detail.priority);
  const [date, setDate] = useState(isoToColomboParts(detail.scheduledDate).date);
  const [team, setTeam] = useState(detail.assignedTeam ?? "");
  const [error, setError] = useState<string | null>(null);
  const ok = title.trim().length > 2 && Boolean(date);
  const m = useMutation({
    mutationFn: () => patchMaintenance(detail.id, { version: detail.version, title: title.trim(), description: description.trim() || undefined, priority, scheduledDate: colomboToIso(date, "09:00"), ...(team.trim() ? { assignedTeam: team.trim() } : {}) }),
    onSuccess: () => { toast.success(copy.passport.edit.success); void refresh(); onClose(); },
    onError: (e) => setError(errorText(e, copy)),
  });
  const d = copy.maint.dialogs;
  return (
    <Shell open onOpenChange={(o) => { if (!o) onClose(); }} title={copy.maint.actions.edit}>
      <form className="ctr-dialog" onSubmit={(e) => { e.preventDefault(); setError(null); if (ok) m.mutate(); }}>
        <Field label={d.jobTitle}>{(id) => <input id={id} className="ctr-input" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} required />}</Field>
        <Field label={d.description}>{(id) => <textarea id={id} className="ctr-input" maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <div className="ctr-row">
          <Field label={d.priority}>{(id) => <select id={id} className="ctr-input" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>{MAINTENANCE_PRIORITIES.map((p) => <option key={p} value={p}>{copy.mpriority[p]}</option>)}</select>}</Field>
          <Field label={d.date}>{(id) => <input id={id} type="date" className="ctr-input" value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
          <Field label={d.team}>{(id) => <input id={id} className="ctr-input" maxLength={120} value={team} onChange={(e) => setTeam(e.target.value)} />}</Field>
        </div>
        {error ? <p className="ctr-error" role="alert">{error}</p> : null}
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}><button type="button" className="ctr-btn" onClick={onClose}>{copy.common.cancel}</button><button type="submit" className="ctr-btn is-primary" disabled={!ok || m.isPending}>{copy.common.save}</button></div>
      </form>
    </Shell>
  );
}

function List({ rows, copy, locale, onOpen }: Common & { rows: MaintRow[]; onOpen: (id: string) => void }) {
  const t = copy.maint.table;
  return (
    <>
      <div className="ins-only-wide" style={{ overflowX: "auto" }}>
        <table className="ins-table">
          <thead><tr>{[t.no, t.title, t.asset, t.type, t.priority, t.status, t.when, t.estimate, t.tasks].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><button type="button" style={{ all: "unset", cursor: "pointer", fontWeight: 700 }} onClick={() => onOpen(r.id)}>{r.maintenanceNo ?? "—"}</button></td>
              <td>{r.title}</td>
              <td><Link className="ins-link" href={`/assets/${r.assetId}`}>{r.assetName ?? "—"}</Link><br /><span className="ins-muted">{r.assetNo ?? ""}</span></td>
              <td>{copy.mtype[r.maintenanceType]}</td><td><PriorityChip priority={r.priority} copy={copy} /></td>
              <td><MaintStatusChip status={r.status} overdue={r.overdue} copy={copy} /></td>
              <td>{fmtDate(r.completedDate ?? r.scheduledDate, locale)}</td><td>{money(r.estimatedCostMinor, locale)}</td><td>{r.tasksDone}/{r.taskCount}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="ins-cards ins-only-narrow">{rows.map((r) => (
        <div key={r.id} className="ins-card" data-overdue={r.overdue}>
          <div className="ins-card-top"><div><button type="button" style={{ all: "unset", cursor: "pointer", fontWeight: 700 }} onClick={() => onOpen(r.id)}>{r.maintenanceNo ?? "—"}</button> <strong>{r.title}</strong><br /><span className="ins-muted">{r.assetName ?? ""} · {copy.mtype[r.maintenanceType]} · {fmtDate(r.completedDate ?? r.scheduledDate, locale)}</span></div></div>
          <div className="ctr-row"><MaintStatusChip status={r.status} overdue={r.overdue} copy={copy} /><PriorityChip priority={r.priority} copy={copy} /></div>
          <button type="button" className="ctr-btn" onClick={() => onOpen(r.id)}>{copy.common.open}</button>
        </div>
      ))}</div>
    </>
  );
}

export function MaintenanceWorkspace() {
  const [locale] = useWorkspaceLocale();
  const copy = getAssetCopy(locale);
  const router = useRouter();
  const { key, roleKey } = useAssetKeys();
  const url = useUrlParams();
  const refresh = useRefreshAssets();
  const filters = useMemo(() => parseMaintFilters((k) => url.get(k) || null), [url]);
  const tabRaw = url.get("tab");
  const tab: Tab = tabRaw === "calendar" || tabRaw === "mine" ? tabRaw : "queue";
  const openId = url.get("open") || null;
  const [calView, setCalView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [search, setSearch] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [initialDate, setInitialDate] = useState<string | undefined>();
  const [act, setAct] = useState<{ a: Act; d: MaintDetail } | null>(null);
  const [edit, setEdit] = useState<MaintDetail | null>(null);
  const [assessFor, setAssessFor] = useState<string | null>(null);
  const canPlan = ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER"].includes(roleKey);
  const canRequest = ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"].includes(roleKey);

  useEffect(() => { if (window.innerWidth < 896) queueMicrotask(() => setCalView("agenda")); }, []);
  const go = (patch: Record<string, string | null>, f: MaintFilters = filters) => {
    const p = maintParams(f);
    if (tab !== "queue") p.set("tab", tab);
    for (const [k, v] of Object.entries(patch)) { if (v === null) p.delete(k); else p.set(k, v); }
    router.replace(p.toString() ? `/maintenance?${p.toString()}` : "/maintenance", { scroll: false });
  };
  const setFilters = (patch: Partial<MaintFilters>) => go({}, { ...filters, ...patch, ...("page" in patch ? {} : { page: 1 }) });
  useEffect(() => { const t = setTimeout(() => { if (search.trim() !== filters.q) setFilters({ q: search.trim() }); }, 350); return () => clearTimeout(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const effective: MaintFilters = tab === "mine" ? { ...filters, mine: true } : filters;
  const summary = useQuery({ queryKey: key("maint-summary"), queryFn: ({ signal }) => fetchMaintSummary(signal), staleTime: 30_000 });
  const list = useQuery({ queryKey: key("maint-list", JSON.stringify(effective)), queryFn: ({ signal }) => fetchMaintenance(maintApiQuery(effective, PAGE), signal), enabled: tab !== "calendar", placeholderData: keepPreviousData });
  const win = windowFor(calView, anchor);
  const cal = useQuery({
    queryKey: key("maint-cal", calView, dayKey(win.from), JSON.stringify({ ...filters, page: 1 })),
    queryFn: ({ signal }) => { const q = maintApiQuery({ ...filters, page: 1 }); delete q.page; delete q.limit; delete q.sort; delete q.dateFrom; delete q.dateTo; return fetchMaintCalendar({ ...q, from: win.from.toISOString(), to: win.to.toISOString() }, signal); },
    enabled: tab === "calendar", placeholderData: keepPreviousData,
  });

  const c = summary.data?.counts;
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const today = dayKey(new Date());
  const kpi = (patch: Partial<MaintFilters>) => { const p = maintParams({ ...DEFAULT_MAINT_FILTERS, ...patch }); router.replace(p.toString() ? `/maintenance?${p.toString()}` : "/maintenance", { scroll: false }); };
  const chips: { label: string; clear: () => void }[] = [
    ...(filters.q ? [{ label: `“${filters.q}”`, clear: () => { setSearch(""); setFilters({ q: "" }); } }] : []),
    ...(filters.status ? [{ label: copy.mstatus[filters.status as keyof typeof copy.mstatus] ?? filters.status, clear: () => setFilters({ status: "" }) }] : []),
    ...(filters.type ? [{ label: copy.mtype[filters.type as keyof typeof copy.mtype] ?? filters.type, clear: () => setFilters({ type: "" }) }] : []),
    ...(filters.priority ? [{ label: copy.mpriority[filters.priority as keyof typeof copy.mpriority] ?? filters.priority, clear: () => setFilters({ priority: "" }) }] : []),
    ...(filters.assetId ? [{ label: copy.common.asset, clear: () => setFilters({ assetId: "" }) }] : []),
    ...(filters.dateFrom ? [{ label: `${copy.maint.filters.from} ${filters.dateFrom}`, clear: () => setFilters({ dateFrom: "" }) }] : []),
    ...(filters.dateTo ? [{ label: `${copy.maint.filters.to} ${filters.dateTo}`, clear: () => setFilters({ dateTo: "" }) }] : []),
    ...(filters.overdue ? [{ label: copy.maint.filters.overdue, clear: () => setFilters({ overdue: false }) }] : []),
  ];
  const k = copy.maint.kpi;

  return (
    <StaffWorkspaceShell title={copy.maint.title} description={copy.maint.description} wide
      context={<ContextBar crumbs={[{ label: copy.nav.maintenance }]} scope={copy.dashboard.scope} asOf={null} actions={<div className="ctr-row">
        <button type="button" className="ctr-btn" onClick={() => void refresh()}><RefreshCwIcon aria-hidden="true" />{copy.common.refresh}</button>
        {canRequest ? <button type="button" className="ctr-btn is-primary" onClick={() => { setInitialDate(undefined); setRequestOpen(true); }}><PlusIcon aria-hidden="true" />{copy.maint.request}</button> : null}
      </div>} />}>
      <div className="ins ast">
        <section className="ins-strip" aria-label={k.hint}>
          <Kpi label={k.requested} value={c?.requested} hint={k.hint} onClick={() => kpi({ status: "REQUESTED" })} />
          <Kpi label={k.next7d} value={c?.next7d} hint={k.hint} onClick={() => kpi({ status: "SCHEDULED", dateFrom: today, dateTo: dayKey(addDays(new Date(), 7)) })} />
          <Kpi label={k.inProgress} value={c?.inProgress} hint={k.hint} onClick={() => kpi({ status: "IN_PROGRESS" })} />
          <Kpi label={k.overdue} value={c?.overdue} hint={k.hint} onClick={() => kpi({ overdue: true })} />
          <Kpi label={k.completed30d} value={c?.completed30d} hint={k.hint} onClick={() => kpi({ status: "COMPLETED", dateFrom: dayKey(addDays(new Date(), -30)) })} />
        </section>
        {summary.data?.oldestRequestAgeDays ? <p className="ins-muted">{fill(copy.maint.waitingAge, { n: summary.data.oldestRequestAgeDays })}</p> : null}

        <div className="ins-bar">
          <div className="ctr-seg" role="group" aria-label={copy.maint.title}>
            {(["queue", "calendar", "mine"] as const).map((t) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => { const p = maintParams(filters); p.delete("page"); if (t !== "queue") p.set("tab", t); router.replace(p.toString() ? `/maintenance?${p.toString()}` : "/maintenance", { scroll: false }); }}>{copy.maint.tabs[t]}{t === "mine" && c ? ` (${c.myOpenRequests})` : ""}</button>)}
          </div>
          <div className="ctr-row">
            <button type="button" className="ctr-btn" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>{copy.maint.filters.toggle}{activeMaintFilterCount(filters) ? ` (${activeMaintFilterCount(filters)})` : ""}</button>
            <button type="button" className="ctr-btn is-ghost" onClick={() => { setSearch(""); router.replace(tab === "queue" ? "/maintenance" : `/maintenance?tab=${tab}`, { scroll: false }); }}>{copy.maint.filters.reset}</button>
          </div>
        </div>
        <div className="ins-panel" hidden={!showFilters && !chips.length}>
          <div className="ins-filters" hidden={!showFilters}>
            <Field label={copy.common.search} wide>{(id) => <input id={id} type="search" className="ctr-input" placeholder={copy.maint.filters.search} value={search} onChange={(e) => setSearch(e.target.value)} />}</Field>
            <Field label={copy.maint.filters.status}>{(id) => <select id={id} className="ctr-input" value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}><option value="">{copy.common.all}</option>{MAINTENANCE_STATUSES.map((s) => <option key={s} value={s}>{copy.mstatus[s]}</option>)}</select>}</Field>
            <Field label={copy.maint.filters.type}>{(id) => <select id={id} className="ctr-input" value={filters.type} onChange={(e) => setFilters({ type: e.target.value })}><option value="">{copy.common.all}</option>{MAINTENANCE_TYPES.map((s) => <option key={s} value={s}>{copy.mtype[s]}</option>)}</select>}</Field>
            <Field label={copy.maint.filters.priority}>{(id) => <select id={id} className="ctr-input" value={filters.priority} onChange={(e) => setFilters({ priority: e.target.value })}><option value="">{copy.common.all}</option>{MAINTENANCE_PRIORITIES.map((s) => <option key={s} value={s}>{copy.mpriority[s]}</option>)}</select>}</Field>
            <Field label={copy.maint.filters.from}>{(id) => <input id={id} type="date" className="ctr-input" value={filters.dateFrom} onChange={(e) => setFilters({ dateFrom: e.target.value })} />}</Field>
            <Field label={copy.maint.filters.to}>{(id) => <input id={id} type="date" className="ctr-input" value={filters.dateTo} onChange={(e) => setFilters({ dateTo: e.target.value })} />}</Field>
            <Field label={copy.maint.filters.sort}>{(id) => <select id={id} className="ctr-input" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>{(["date_asc", "date_desc", "priority"] as const).map((s) => <option key={s} value={s}>{copy.maint.filters.sorts[s]}</option>)}</select>}</Field>
            <label className="ins-toggle"><input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ overdue: e.target.checked })} />{copy.maint.filters.overdue}</label>
          </div>
          {chips.length ? <div className="ins-chips">{chips.map((ch, i) => <span key={i} className="ins-chip">{ch.label}<button type="button" onClick={ch.clear} aria-label={`${copy.common.clear}: ${ch.label}`}><XIcon aria-hidden="true" /></button></span>)}</div> : null}
        </div>

        {tab === "calendar" ? (
          cal.isError ? <ErrorState error={cal.error} copy={copy} onRetry={() => void cal.refetch()} /> : (
            <MaintCalendar rows={cal.data?.rows ?? []} view={calView} anchor={anchor} copy={copy} locale={locale} loading={cal.isFetching} truncated={cal.data?.truncated ?? false} canRequest={canRequest}
              onView={setCalView} onAnchor={setAnchor} onOpen={(id) => go({ open: id })} onNew={(d) => { setInitialDate(dayKey(d)); setRequestOpen(true); }} />
          )
        ) : list.isPending ? <Skeletons /> : list.isError ? <ErrorState error={list.error} copy={copy} onRetry={() => void list.refetch()} /> : list.data.rows.length === 0 ? (
          <EmptyState title={copy.maint.empty.title} body={copy.maint.empty.body} action={canRequest ? <button type="button" className="ctr-btn is-primary" onClick={() => setRequestOpen(true)}>{copy.maint.request}</button> : undefined} />
        ) : (
          <>
            <List rows={list.data.rows} copy={copy} locale={locale} onOpen={(id) => go({ open: id })} />
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

      {openId ? <MaintDrawer id={openId} copy={copy} locale={locale} onClose={() => go({ open: null })} onAct={(a, d) => setAct({ a, d })} onEdit={(d) => setEdit(d)} /> : null}
      {act ? <ActionDialog act={act.a} detail={act.d} copy={copy} onClose={() => setAct(null)} onDone={(r) => { setAct(null); if (r.completed && r.assetId) setAssessFor(r.assetId); }} /> : null}
      {edit ? <EditMaintDialog detail={edit} copy={copy} onClose={() => setEdit(null)} /> : null}
      <RequestMaintenanceDialog open={requestOpen} onOpenChange={setRequestOpen} copy={copy} locale={locale} canPlan={canPlan} {...(initialDate ? { initialDate } : {})} />
      <Shell open={assessFor !== null} onOpenChange={(o) => { if (!o) setAssessFor(null); }} title={copy.maint.dialogs.afterTitle} description={copy.maint.dialogs.afterBody}>
        <div className="ctr-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="ctr-btn" onClick={() => setAssessFor(null)}>{copy.maint.dialogs.later}</button>
          <Link className="ctr-btn is-primary" href={`/assets/${assessFor ?? ""}?action=assessment`}>{copy.maint.dialogs.recordNow}</Link>
        </div>
      </Shell>
    </StaffWorkspaceShell>
  );
}

export { MaintStepper };
