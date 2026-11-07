"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { MoreHorizontalIcon, PlusIcon, RefreshCwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ContextBar } from "@/components/site-plan/site-plan";
import { fetchCalendar, fetchInspections, fetchSummary, startInspection } from "@/lib/inspections/api";
import { addDays, dayKey, isoToColomboParts, windowFor, type CalendarView } from "@/lib/inspections/calendar-math";
import { activeFilterCount, DEFAULT_FILTERS, parseFilters, toApiQuery, toParams, type ListFilters } from "@/lib/inspections/list-query";
import { getInspectionCopy, type Copy } from "@/lib/inspections/messages";
import { hintAssign, isInspectorRole, useInspectionKeys } from "@/lib/inspections/session";
import { INSPECTION_PRIORITIES, INSPECTION_STATUSES, INSPECTION_TYPES, type InspectionRow, type Summary } from "@/lib/inspections/types";
import { fill, fmtDate, fmtTime } from "@/lib/inspections/view";
import { useUrlParams } from "@/lib/finance/url-state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import type { AuthLocale } from "@/lib/auth/types";

import { InspectionCalendar } from "./inspection-calendar";
import { CancelDialog, ReassignDialog, RescheduleDialog, ScheduleDialog, useRefreshInspections, type ScheduleInitial } from "./inspection-dialogs";
import { EmptyState, ErrorState, Field, InspectionStepper, PriorityChip, Skeletons, StatusBadge, errorText, ppText } from "./inspection-ui";

type View = "list" | "calendar" | "review";
type Common = { copy: Copy; locale: AuthLocale };
const PAGE = 20;

function Kpi({ label, value, hint, onClick, pressed }: { label: string; value: number | undefined; hint: string; onClick: () => void; pressed?: boolean }) {
  return (
    <button type="button" className="ctr-card" onClick={onClick} aria-pressed={pressed} aria-label={`${label}: ${value ?? "—"}. ${hint}`}>
      <span className="ctr-card-label">{label}</span><span className="ctr-card-value">{value ?? "—"}</span><span className="ctr-card-hint">{hint}</span>
    </button>
  );
}

/** Per-row actions only appear when the server said the viewer may use them; the buttons open the real dialogs. */
function RowMenu({ row, copy, canAssign, onReschedule, onReassign, onCancel }: Common & { row: InspectionRow; canAssign: boolean; onReschedule: () => void; onReassign: () => void; onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("mousedown", h); document.addEventListener("keydown", k); return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); }; }, [open]);
  const live = row.status === "SCHEDULED" || row.status === "IN_PROGRESS";
  return (
    <div className="ins-menu" ref={ref}>
      <button type="button" className="ctr-btn is-ghost" aria-haspopup="menu" aria-expanded={open} aria-label={`${copy.overview.table.rowMenu}: ${row.inspectionNo ?? ""}`} onClick={() => setOpen(!open)}><MoreHorizontalIcon aria-hidden="true" /></button>
      {open ? (
        <div className="ins-menu-list" role="menu">
          <Link role="menuitem" className="ctr-btn is-ghost" href={`/inspections/${row.id}`} style={{ justifyContent: "flex-start" }}>{copy.overview.open}</Link>
          {canAssign && live ? <button role="menuitem" type="button" onClick={() => { setOpen(false); onReschedule(); }}>{copy.overview.reschedule}</button> : null}
          {canAssign && live ? <button role="menuitem" type="button" onClick={() => { setOpen(false); onReassign(); }}>{copy.overview.reassign}</button> : null}
          {canAssign && live ? <button role="menuitem" type="button" onClick={() => { setOpen(false); onCancel(); }}>{copy.overview.cancel}</button> : null}
        </div>
      ) : null}
    </div>
  );
}

function InspectionList({ rows, copy, locale, canAssign, actions }: Common & { rows: InspectionRow[]; canAssign: boolean; actions: { reschedule: (r: InspectionRow) => void; reassign: (r: InspectionRow) => void; cancel: (r: InspectionRow) => void } }) {
  const menu = (r: InspectionRow) => <RowMenu row={r} copy={copy} locale={locale} canAssign={canAssign} onReschedule={() => actions.reschedule(r)} onReassign={() => actions.reassign(r)} onCancel={() => actions.cancel(r)} />;
  return (
    <>
      <div className="ins-only-wide" style={{ overflowX: "auto" }}>
        <table className="ins-table">
          <thead><tr>{[copy.overview.table.no, copy.overview.table.project, copy.overview.table.type, copy.overview.table.when, copy.overview.table.inspector, copy.overview.table.status, copy.overview.table.priority, copy.overview.table.evidence, copy.overview.table.progress].map((h) => <th key={h} scope="col">{h}</th>)}<th scope="col"><span className="sr-only">{copy.overview.table.actions}</span></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link className="ins-link" href={`/inspections/${r.id}`}>{r.inspectionNo ?? "—"}</Link></td>
                <td><strong>{r.projectCode}</strong><br /><span className="ins-muted">{r.projectTitle}</span></td>
                <td>{copy.type[r.inspectionType]}</td>
                <td>{fmtDate(r.inspectionDate, locale)}<br /><span className="ins-muted">{fmtTime(r.inspectionDate, locale)}</span></td>
                <td>{r.inspectorName ?? "—"}</td>
                <td><StatusBadge status={r.status} overdue={r.overdue} copy={copy} /><InspectionStepper status={r.status} copy={copy} /></td>
                <td><PriorityChip priority={r.priority} copy={copy} /></td>
                <td>{r.evidenceCount}</td>
                <td>{r.claimedProgress ?? "—"}% / {r.measuredProgress ?? "—"}%{r.discrepancyPp !== null && Math.abs(r.discrepancyPp) > 10 ? <><br /><span className="ins-prio" data-p="HIGH">{ppText(r.discrepancyPp, copy)}</span></> : null}</td>
                <td>{menu(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ins-cards ins-only-narrow">
        {rows.map((r) => (
          <div key={r.id} className="ins-card" data-overdue={r.overdue}>
            <div className="ins-card-top"><div><Link className="ins-link" href={`/inspections/${r.id}`}>{r.inspectionNo}</Link><br /><strong>{r.projectCode}</strong> <span className="ins-muted">{r.projectTitle}</span></div>{menu(r)}</div>
            <div className="ctr-row"><StatusBadge status={r.status} overdue={r.overdue} copy={copy} /><PriorityChip priority={r.priority} copy={copy} /></div>
            <span className="ins-muted">{copy.type[r.inspectionType]} · {fmtDate(r.inspectionDate, locale)} {fmtTime(r.inspectionDate, locale)} · {r.inspectorName ?? "—"}</span>
            <InspectionStepper status={r.status} copy={copy} />
            <Link className="ctr-btn" href={`/inspections/${r.id}`}>{copy.overview.open}</Link>
          </div>
        ))}
      </div>
    </>
  );
}

function Insights({ summary, copy, locale }: Common & { summary: Summary }) {
  const o = summary.outcomes;
  const total = (o.APPROVED ?? 0) + (o.REVISION_REQUESTED ?? 0) + (o.REJECTED ?? 0);
  const bar = (label: string, n: number, tone: string) => (
    <div className="ins-gauge-row"><span>{label}</span><span className="ins-gauge-track"><i style={{ width: `${total ? (n / total) * 100 : 0}%`, background: tone }} /></span><strong>{n}</strong></div>
  );
  return (
    <section className="ins-panel" aria-label={copy.overview.insights}>
      <h2 className="ins-h">{copy.overview.insights}</h2>
      <div className="ctr-grid2">
        <div><strong>{copy.overview.turnaround}</strong><p className="ins-muted">{summary.turnaround.enough && summary.turnaround.medianHours !== null ? fill(copy.overview.turnaroundValue, { h: summary.turnaround.medianHours, n: summary.turnaround.sample }) : fill(copy.overview.notEnough, { n: summary.turnaround.sample })}</p></div>
        <div><strong>{copy.overview.outcomes}</strong>{total ? <div className="ins-gauge">{bar(copy.overview.outcomeApproved, o.APPROVED ?? 0, "var(--infra-green)")}{bar(copy.overview.outcomeRevision, o.REVISION_REQUESTED ?? 0, "var(--infra-orange)")}{bar(copy.overview.outcomeRejected, o.REJECTED ?? 0, "var(--infra-maroon)")}</div> : <p className="ins-muted">{copy.overview.outcomesEmpty}</p>}</div>
      </div>
      <div><strong>{copy.overview.gaps}</strong><p className="ins-muted">{copy.overview.gapsHint}</p>
        {summary.verificationGaps.length ? summary.verificationGaps.map((g) => (
          <Link key={g.inspectionId} href={`/inspections/${g.inspectionId}`} className="ins-agenda-row" style={{ gridTemplateColumns: "1fr auto" }}>
            <span><strong>{g.projectCode}</strong> <span className="ins-muted">{g.projectTitle}</span><br /><span className="ins-muted">{copy.overview.claimed} {g.claimedPercent ?? "—"}% · {copy.overview.verified} {g.verifiedPercent}% · {fmtDate(g.asOf, locale)}</span></span>
            <span className="ins-prio" data-p={Math.abs(g.discrepancyPp) > 10 ? "HIGH" : "NORMAL"}>{ppText(g.discrepancyPp, copy)}</span>
          </Link>
        )) : <p className="ins-muted">{copy.overview.gapsEmpty}</p>}
      </div>
    </section>
  );
}

export function InspectionsDashboard() {
  const [locale] = useWorkspaceLocale();
  const copy = getInspectionCopy(locale);
  const router = useRouter();
  const { roleKey, key } = useInspectionKeys();
  const url = useUrlParams();
  const refresh = useRefreshInspections();
  const canAssign = hintAssign(roleKey);
  const inspector = isInspectorRole(roleKey);

  const view: View = (["list", "calendar", "review"] as const).includes(url.get("view") as View) ? (url.get("view") as View) : "list";
  const filters = useMemo(() => parseFilters((k) => url.get(k) || null), [url]);
  const [calView, setCalView] = useState<CalendarView>(() => url.get("cal") === "month" || url.get("cal") === "week" || url.get("cal") === "agenda" ? (url.get("cal") as CalendarView) : "month");
  useEffect(() => { if (!url.get("cal") && window.innerWidth < 896) queueMicrotask(() => setCalView("agenda")); }, [url]);
  const [anchor, setAnchor] = useState(() => new Date());
  const [search, setSearch] = useState(filters.q);
  const [showFilters, setShowFilters] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [initial, setInitial] = useState<ScheduleInitial | undefined>();
  const [rs, setRs] = useState<InspectionRow | null>(null);
  const [ra, setRa] = useState<InspectionRow | null>(null);
  const [rc, setRc] = useState<InspectionRow | null>(null);

  const setFilters = (patch: Partial<ListFilters>) => {
    const next = { ...filters, ...patch, ...("page" in patch ? {} : { page: 1 }) };
    const params = toParams(next);
    if (view !== "list") params.set("view", view);
    if (url.get("cal")) params.set("cal", url.get("cal"));
    router.replace(params.toString() ? `/inspections?${params.toString()}` : "/inspections", { scroll: false });
  };
  const setView = (v: View) => { const p = toParams(filters); if (v !== "list") p.set("view", v); router.replace(p.toString() ? `/inspections?${p.toString()}` : "/inspections", { scroll: false }); };
  useEffect(() => { const t = setTimeout(() => { if (search !== filters.q) setFilters({ q: search.trim() }); }, 350); return () => clearTimeout(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const effective: ListFilters = view === "review" ? { ...filters, status: ["SUBMITTED"], needsReview: true } : filters;
  const summary = useQuery({ queryKey: key("summary"), queryFn: ({ signal }) => fetchSummary({}, signal), staleTime: 30_000 });
  const list = useQuery({ queryKey: key("list", JSON.stringify(effective)), queryFn: ({ signal }) => fetchInspections(toApiQuery(effective, PAGE), signal), enabled: view !== "calendar", placeholderData: keepPreviousData });
  const win = windowFor(calView, anchor);
  const cal = useQuery({
    queryKey: key("calendar", calView, dayKey(win.from), JSON.stringify({ ...filters, page: 1 })),
    queryFn: ({ signal }) => { const q = toApiQuery({ ...filters, page: 1 }); delete q.page; delete q.limit; delete q.sort; delete q.dateFrom; delete q.dateTo; return fetchCalendar({ ...q, from: win.from.toISOString(), to: win.to.toISOString() }, signal); },
    enabled: view === "calendar", placeholderData: keepPreviousData,
  });

  const start = useMutation({ mutationFn: (id: string) => startInspection(id), onSuccess: (_d, id) => { toast.success(copy.dialogs.started); void refresh(); router.push(`/inspections/${id}/report`); }, onError: (e) => toast.error(errorText(e, copy)) });

  const openSchedule = (day?: Date) => { const p = day ? isoToColomboParts(day.toISOString()) : null; setInitial(p ? { date: p.date, time: "09:00" } : undefined); setScheduleOpen(true); };
  const kpiClick = (patch: Partial<ListFilters>) => { const p = toParams({ ...DEFAULT_FILTERS, ...patch }); router.replace(p.toString() ? `/inspections?${p.toString()}` : "/inspections", { scroll: false }); };
  const today = dayKey(new Date());
  const c = summary.data?.counts;
  const chips: { label: string; clear: () => void }[] = [
    ...(filters.q ? [{ label: `“${filters.q}”`, clear: () => { setSearch(""); setFilters({ q: "" }); } }] : []),
    ...filters.status.map((s) => ({ label: copy.status[s as keyof typeof copy.status], clear: () => setFilters({ status: filters.status.filter((x) => x !== s) }) })),
    ...(filters.type ? [{ label: copy.type[filters.type as keyof typeof copy.type], clear: () => setFilters({ type: "" }) }] : []),
    ...(filters.priority ? [{ label: copy.priority[filters.priority as keyof typeof copy.priority], clear: () => setFilters({ priority: "" }) }] : []),
    ...(filters.inspectorId ? [{ label: `${copy.overview.filters.inspector}`, clear: () => setFilters({ inspectorId: "" }) }] : []),
    ...(filters.projectId ? [{ label: copy.overview.table.project, clear: () => setFilters({ projectId: "" }) }] : []),
    ...(filters.dateFrom ? [{ label: `${copy.overview.filters.dateFrom} ${filters.dateFrom}`, clear: () => setFilters({ dateFrom: "" }) }] : []),
    ...(filters.dateTo ? [{ label: `${copy.overview.filters.dateTo} ${filters.dateTo}`, clear: () => setFilters({ dateTo: "" }) }] : []),
    ...(filters.overdue ? [{ label: copy.overview.filters.overdue, clear: () => setFilters({ overdue: false }) }] : []),
    ...(filters.mine ? [{ label: copy.overview.filters.mine, clear: () => setFilters({ mine: false }) }] : []),
  ];
  const inspectors = useMemo(() => { const m = new Map<string, string>(); for (const r of list.data?.rows ?? []) if (r.inspectorName) m.set(r.inspectorId, r.inspectorName); return [...m]; }, [list.data]);
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const primaryAction = (r: InspectionRow) => {
    if (inspector) {
      if (r.status === "SCHEDULED") return r.canStart !== false ? <button type="button" className="ctr-btn is-primary" disabled={start.isPending} onClick={() => start.mutate(r.id)}>{copy.overview.start}</button> : <Link className="ctr-btn" href={`/inspections/${r.id}`}>{copy.overview.open}</Link>;
      if (r.status === "IN_PROGRESS") return <Link className="ctr-btn is-primary" href={`/inspections/${r.id}/report`}>{copy.overview.continueDraft}</Link>;
      if (r.status === "REQUIRES_REVIEW") return <Link className="ctr-btn is-primary" href={`/inspections/${r.id}/report`}>{copy.overview.revise}</Link>;
    }
    if (r.status === "SUBMITTED") return <Link className="ctr-btn is-primary" href={`/inspections/${r.id}?tab=review`}>{copy.overview.review}</Link>;
    if (canAssign && r.overdue) return <button type="button" className="ctr-btn is-primary" onClick={() => setRs(r)}>{copy.overview.reschedule}</button>;
    return <Link className="ctr-btn" href={`/inspections/${r.id}`}>{copy.overview.open}</Link>;
  };

  return (
    <StaffWorkspaceShell title={copy.overview.title} description={copy.overview.description} wide
      context={<ContextBar crumbs={[{ label: copy.nav.title }]} scope={copy.overview.scope} asOf={null} actions={<div className="ctr-row">
        <button type="button" className="ctr-btn" onClick={() => { void refresh(); }}><RefreshCwIcon aria-hidden="true" />{copy.common.refresh}</button>
        {inspector ? <Link className="ctr-btn" href="/inspections/my">{copy.nav.my}</Link> : null}
        {canAssign ? <button type="button" className="ctr-btn is-primary" onClick={() => openSchedule()}><PlusIcon aria-hidden="true" />{copy.overview.schedule}</button> : null}
      </div>} />}>
      <div className="ins">
        <section className="ins-strip" aria-label={copy.kpi.hint}>
          <Kpi label={copy.kpi.upcoming7d} value={c?.upcoming7d} hint={copy.kpi.hint} onClick={() => kpiClick({ status: ["SCHEDULED"], dateFrom: today, dateTo: dayKey(addDays(new Date(), 7)) })} />
          <Kpi label={copy.kpi.inProgress} value={c?.inProgress} hint={copy.kpi.hint} pressed={filters.status.join() === "IN_PROGRESS"} onClick={() => kpiClick({ status: ["IN_PROGRESS"] })} />
          <Kpi label={copy.kpi.awaitingReview} value={c?.awaitingReview} hint={copy.kpi.hint} onClick={() => router.replace("/inspections?view=review", { scroll: false })} />
          <Kpi label={copy.kpi.revisionRequired} value={c?.revisionRequired} hint={copy.kpi.hint} onClick={() => kpiClick({ status: ["REQUIRES_REVIEW"] })} />
          <Kpi label={copy.kpi.overdue} value={c?.overdue} hint={copy.kpi.hint} pressed={filters.overdue} onClick={() => kpiClick({ overdue: true })} />
          <Kpi label={copy.kpi.verified30d} value={c?.verified30d} hint={copy.kpi.hint} onClick={() => kpiClick({ status: ["VERIFIED"], dateFrom: dayKey(addDays(new Date(), -30)) })} />
        </section>

        <section className="ins-panel" aria-label={copy.overview.needsAction}>
          <h2 className="ins-h">{copy.overview.needsAction}</h2>
          {summary.isPending ? <Skeletons n={1} /> : summary.isError ? <ErrorState error={summary.error} copy={copy} onRetry={() => void summary.refetch()} /> : summary.data.needsAction.length === 0 ? <p className="ins-muted">{copy.overview.needsActionEmpty}</p> : (
            <div className="ins-cards">{summary.data.needsAction.map((r) => (
              <div key={r.id} className="ins-card" data-overdue={r.overdue}>
                <div className="ins-card-top"><div><Link className="ins-link" href={`/inspections/${r.id}`}>{r.inspectionNo}</Link> <strong>{r.projectCode}</strong><br /><span className="ins-muted">{copy.type[r.inspectionType]} · {fmtDate(r.inspectionDate, locale)} {fmtTime(r.inspectionDate, locale)}</span></div><StatusBadge status={r.status} overdue={r.overdue} copy={copy} /></div>
                <div className="ctr-row">{primaryAction(r)}</div>
              </div>
            ))}</div>
          )}
        </section>

        <div className="ins-bar">
          <div className="ctr-seg" role="group" aria-label={copy.nav.title}>
            {(["list", "calendar", "review"] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === "list" ? copy.overview.viewList : v === "calendar" ? copy.overview.viewCalendar : copy.overview.viewReview}</button>)}
          </div>
          <div className="ctr-row">
            <button type="button" className="ctr-btn" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>{copy.overview.filters.toggle}{activeFilterCount(filters) ? ` (${activeFilterCount(filters)})` : ""}</button>
            <button type="button" className="ctr-btn is-ghost" onClick={() => { setSearch(""); router.replace(view === "list" ? "/inspections" : `/inspections?view=${view}`, { scroll: false }); }}>{copy.overview.filters.reset}</button>
          </div>
        </div>

        {view === "review" ? <p className="ins-muted">{copy.overview.reviewQueueHint}</p> : null}

        <div className="ins-panel" hidden={!showFilters && !activeFilterCount(filters)}>
          <div className="ins-filters" hidden={!showFilters}>
            <Field label={copy.common.search} wide>{(id) => <input id={id} type="search" className="ctr-input" placeholder={copy.overview.filters.search} value={search} onChange={(e) => setSearch(e.target.value)} />}</Field>
            {view !== "review" ? <Field label={copy.overview.filters.status}>{(id) => (
              <select id={id} className="ctr-input" value={filters.status[0] ?? ""} onChange={(e) => setFilters({ status: e.target.value ? [e.target.value] : [] })}>
                <option value="">{copy.common.all}</option>{INSPECTION_STATUSES.map((s) => <option key={s} value={s}>{copy.status[s]}</option>)}
              </select>
            )}</Field> : null}
            <Field label={copy.overview.filters.type}>{(id) => <select id={id} className="ctr-input" value={filters.type} onChange={(e) => setFilters({ type: e.target.value })}><option value="">{copy.overview.filters.anyType}</option>{INSPECTION_TYPES.map((t) => <option key={t} value={t}>{copy.type[t]}</option>)}</select>}</Field>
            <Field label={copy.overview.filters.priority}>{(id) => <select id={id} className="ctr-input" value={filters.priority} onChange={(e) => setFilters({ priority: e.target.value })}><option value="">{copy.overview.filters.anyPriority}</option>{INSPECTION_PRIORITIES.map((t) => <option key={t} value={t}>{copy.priority[t]}</option>)}</select>}</Field>
            {!inspector ? <Field label={copy.overview.filters.inspector}>{(id) => <select id={id} className="ctr-input" value={filters.inspectorId} onChange={(e) => setFilters({ inspectorId: e.target.value })}><option value="">{copy.common.all}</option>{inspectors.map(([i, n]) => <option key={i} value={i}>{n}</option>)}{filters.inspectorId && !inspectors.some(([i]) => i === filters.inspectorId) ? <option value={filters.inspectorId}>{copy.overview.filters.inspector}</option> : null}</select>}</Field> : null}
            <Field label={copy.overview.filters.dateFrom}>{(id) => <input id={id} type="date" className="ctr-input" value={filters.dateFrom} onChange={(e) => setFilters({ dateFrom: e.target.value })} />}</Field>
            <Field label={copy.overview.filters.dateTo}>{(id) => <input id={id} type="date" className="ctr-input" value={filters.dateTo} onChange={(e) => setFilters({ dateTo: e.target.value })} />}</Field>
            <Field label={copy.overview.filters.sort}>{(id) => <select id={id} className="ctr-input" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value as ListFilters["sort"] })}><option value="date_asc">{copy.overview.filters.sortAsc}</option><option value="date_desc">{copy.overview.filters.sortDesc}</option></select>}</Field>
            <label className="ins-toggle"><input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ overdue: e.target.checked })} />{copy.overview.filters.overdue}</label>
            <label className="ins-toggle"><input type="checkbox" checked={filters.mine} onChange={(e) => setFilters({ mine: e.target.checked })} />{copy.overview.filters.mine}</label>
          </div>
          {chips.length ? <div className="ins-chips" aria-label={copy.overview.filters.applied}>{chips.map((ch, i) => <span key={i} className="ins-chip">{ch.label}<button type="button" onClick={ch.clear} aria-label={`${copy.common.clear}: ${ch.label}`}><XIcon aria-hidden="true" /></button></span>)}</div> : null}
        </div>

        {view === "calendar" ? (
          cal.isError ? <ErrorState error={cal.error} copy={copy} onRetry={() => void cal.refetch()} /> : (
            <InspectionCalendar rows={cal.data?.rows ?? []} view={calView} anchor={anchor} locale={locale} copy={copy} truncated={cal.data?.truncated ?? false} loading={cal.isFetching}
              canSchedule={canAssign} canReschedule={canAssign} onView={(v) => { setCalView(v); const p = new URLSearchParams(window.location.search); p.set("cal", v); router.replace(`/inspections?${p.toString()}`, { scroll: false }); }} onAnchor={setAnchor}
              onSchedule={(d) => openSchedule(d)} onReschedule={(r) => setRs(r)} />
          )
        ) : list.isPending ? <Skeletons /> : list.isError ? <ErrorState error={list.error} copy={copy} onRetry={() => void list.refetch()} /> : list.data.rows.length === 0 ? (
          <EmptyState title={view === "review" ? copy.overview.reviewQueueEmpty : copy.overview.empty.title} body={activeFilterCount(filters) ? copy.overview.empty.body : copy.overview.empty.unfiltered}
            action={canAssign && view !== "review" ? <button type="button" className="ctr-btn is-primary" onClick={() => openSchedule()}>{copy.overview.schedule}</button> : undefined} />
        ) : (
          <>
            <InspectionList rows={list.data.rows} copy={copy} locale={locale} canAssign={canAssign} actions={{ reschedule: setRs, reassign: setRa, cancel: setRc }} />
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

        {summary.data && !inspector ? <Insights summary={summary.data} copy={copy} locale={locale} /> : null}
        <p className="ins-muted">{copy.common.syntheticNote}</p>
      </div>

      <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} copy={copy} locale={locale} initial={initial} />
      <RescheduleDialog row={rs} onClose={() => setRs(null)} copy={copy} locale={locale} />
      <ReassignDialog row={ra} onClose={() => setRa(null)} copy={copy} locale={locale} />
      <CancelDialog row={rc} onClose={() => setRc(null)} copy={copy} />
    </StaffWorkspaceShell>
  );
}

