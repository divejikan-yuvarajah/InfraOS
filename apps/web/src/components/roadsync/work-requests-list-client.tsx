"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { PlusIcon, RefreshCwIcon, RouteIcon } from "lucide-react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { StatusChip } from "@/components/site-plan/site-plan";
import { RouteLines } from "@/components/motif/connected-motif";
import { fetchProjects } from "@/lib/projects/api";
import { classifyWorkRequestError, fetchWorkRequestMap, fetchWorkRequests } from "@/lib/roadsync/api";
import {
  canHintCreate,
  ELIGIBLE_PROJECT_STATUSES,
  EMPTY_FILTERS,
  filtersToQuery,
  formatWindow,
  hasActiveFilters,
  statusLabel,
  WORK_PRIORITIES,
  WORK_STATUSES,
  WORK_TYPES,
  workRequestQueryKey,
  type WorkRequestFilters,
} from "@/lib/roadsync/work-requests-view";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";

import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { BANDS_DESC, fmt, type Band } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { getWorkRequestCopy } from "@/lib/roadsync/work-request-copy";
import { getConflictCopy } from "@/lib/roadsync/conflict-records-copy";

import { BandPill } from "./risk-visuals";
import { PriorityMark, WorkTypeIcon } from "./roadsync-shared";
import { WorkMap } from "./work-map";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

export function WorkRequestsListClient() {
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const [filters, setFilters] = useState<WorkRequestFilters>(EMPTY_FILTERS);
  const [locale] = useWorkspaceLocale();
  const risk = getAssessmentCopy(locale);
  const wc = getWorkRequestCopy(locale);
  const lc = wc.list;
  const failText = (kind: ReturnType<typeof classifyWorkRequestError>) => wc.failures[kind === "not-found" ? "notFound" : kind];
  const query = filtersToQuery(filters);
  const router = useRouter();
  const [view, setView] = useState<"list" | "map">("list");
  // The map endpoint takes the same filters but no paging; it shares the list/detail RBAC scope on the server.
  const mapQuery = new URLSearchParams(Object.entries({ status: filters.status, workType: filters.workType, priority: filters.priority, projectId: filters.projectId }).filter(([, v]) => v) as [string, string][]).toString();

  const list = useQuery({
    queryKey: workRequestQueryKey(epoch, userId, roleKey, query),
    queryFn: () => fetchWorkRequests(query),
    enabled: Boolean(userId),
    retry: false,
  });
  const mapData = useQuery({
    queryKey: workRequestQueryKey(epoch, userId, roleKey, "map:" + mapQuery),
    queryFn: () => fetchWorkRequestMap(mapQuery),
    enabled: Boolean(userId) && view === "map",
    retry: false,
  });
  const projects = useQuery({
    queryKey: workRequestQueryKey(epoch, userId, roleKey, "project-options"),
    queryFn: () => fetchProjects({ page: 1, limit: 25, sortBy: "title", sortDir: "asc" }),
    enabled: Boolean(userId),
    retry: false,
  });

  const data = list.data;
  const failure = list.error ? classifyWorkRequestError(list.error) : null;
  const filtered = hasActiveFilters(filters);
  const set = (patch: Partial<WorkRequestFilters>) => setFilters((c) => ({ ...c, ...patch, page: 1 }));
  const byStatus = data?.counts.byStatus ?? {};
  const byPriority = data?.counts.byPriority ?? {};
  const scopeTotal = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const urgent = (byPriority.HIGH ?? 0) + (byPriority.CRITICAL ?? 0);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <StaffWorkspaceShell title={lc.title} description={lc.description} wide>
      <div className="rs-page">
        <div className="rs-eyebrow">
          <p className="rs-crumb">{lc.crumb}</p>
          <div className="rs-seg rs-view" role="group" aria-label={lc.viewLabel}>
            <button type="button" className="rs-btn" aria-pressed={view === "list"} onClick={() => setView("list")}>{lc.viewList}</button>
            <button type="button" className="rs-btn" aria-pressed={view === "map"} onClick={() => setView("map")}>{lc.viewMap}</button>
          </div>
          {canHintCreate(roleKey) ? (
            <Link href="/roadsync/work-requests/new" className="rs-btn is-primary">
              <PlusIcon aria-hidden="true" />
              {lc.create}
            </Link>
          ) : null}
        </div>

        {data ? (
          <section className="rs-tiles" aria-label={lc.tilesLabel}>
            <div className="rs-tile" style={{ ["--rs-accent" as string]: "var(--infra-orange)" }}>
              <p className="rs-tile-label">{lc.scope}</p>
              <p className="rs-tile-value">{scopeTotal}</p>
              <p className="rs-tile-note">{lc.scopeNote}</p>
            </div>
            <div className="rs-tile" style={{ ["--rs-accent" as string]: "#94a3b8" }}>
              <p className="rs-tile-label">{lc.drafts}</p>
              <p className="rs-tile-value">{byStatus.DRAFT ?? 0}</p>
              <p className="rs-tile-note">{lc.draftsNote}</p>
            </div>
            <div className="rs-tile" style={{ ["--rs-accent" as string]: "var(--infra-yellow, #feb600)" }}>
              <p className="rs-tile-label">{lc.urgent}</p>
              <p className="rs-tile-value">{urgent}</p>
              <p className="rs-tile-note">{lc.urgentNote}</p>
            </div>
          </section>
        ) : null}

        <form className="rs-filters" aria-label={lc.filtersLabel} onSubmit={(e) => e.preventDefault()}>
          <label className="rs-field">
            <span className="rs-label">{lc.status}</span>
            <select className="rs-input" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="">{lc.allStatuses}</option>
              {WORK_STATUSES.map((s) => (
                <option key={s} value={s}>{lc.statuses[s] ?? statusLabel(s)}</option>
              ))}
            </select>
          </label>
          <label className="rs-field">
            <span className="rs-label">{lc.workType}</span>
            <select className="rs-input" value={filters.workType} onChange={(e) => set({ workType: e.target.value })}>
              <option value="">{lc.allWorkTypes}</option>
              {WORK_TYPES.map((t) => (
                <option key={t} value={t}>{lc.workTypes[t]}</option>
              ))}
            </select>
          </label>
          <label className="rs-field">
            <span className="rs-label">{lc.priority}</span>
            <select className="rs-input" value={filters.priority} onChange={(e) => set({ priority: e.target.value })}>
              <option value="">{lc.allPriorities}</option>
              {WORK_PRIORITIES.map((p) => (
                <option key={p} value={p}>{lc.priorities[p]}</option>
              ))}
            </select>
          </label>
          <label className="rs-nb-check">
            <input type="checkbox" checked={Boolean(filters.hasCandidates)} onChange={(e) => set({ hasCandidates: e.target.checked })} />
            {lc.nearby}
          </label>
          <label className="rs-field">
            <span className="rs-label">{risk.list.bandFilter}</span>
            <select className="rs-input" value={filters.band ?? ""} onChange={(e) => set({ band: e.target.value })}>
              <option value="">—</option>
              {BANDS_DESC.map((b) => <option key={b} value={b}>{risk.bands[b]}</option>)}
            </select>
          </label>
          <label className="rs-nb-check">
            <input type="checkbox" checked={Boolean(filters.hasConflicts)} onChange={(e) => set({ hasConflicts: e.target.checked })} />
            {risk.list.hasConflicts}
          </label>
          <label className="rs-field">
            <span className="rs-label">{risk.filters.sort}</span>
            <select className="rs-input" value={filters.sort ?? ""} onChange={(e) => set({ sort: e.target.value === "riskIndex" ? "riskIndex" : undefined })}>
              <option value="">{risk.list.sortDate}</option>
              <option value="riskIndex">{risk.list.sortRisk}</option>
            </select>
          </label>
          {projects.data ? (
            <label className="rs-field">
              <span className="rs-label">{lc.project}</span>
              <select className="rs-input" value={filters.projectId} onChange={(e) => set({ projectId: e.target.value })}>
                <option value="">{lc.allProjects}</option>
                {projects.data.projects
                  .filter((p) => (ELIGIBLE_PROJECT_STATUSES as readonly string[]).includes(p.status) || p.id === filters.projectId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.projectCode} · {p.title}</option>
                  ))}
              </select>
            </label>
          ) : null}
          {filtered ? (
            <button type="button" className="rs-btn" onClick={() => setFilters(EMPTY_FILTERS)}>
              {lc.reset}
            </button>
          ) : null}
        </form>

        {view === "map" ? (
          mapData.isPending ? (
            <div className="rs-skel-row" role="status" aria-label={lc.mapLoading} style={{ height: 420 }} />
          ) : mapData.isError ? (
            <div className="rs-state" role="alert">
              <h2>{lc.mapFailed}</h2>
              <p>{failText(classifyWorkRequestError(mapData.error))}</p>
              <button type="button" className="rs-btn" onClick={() => void mapData.refetch()}><RefreshCwIcon aria-hidden="true" />{lc.retry}</button>
            </div>
          ) : (
            <section aria-label={lc.mapLabel}>
              <WorkMap features={mapData.data.features} height={460} label={lc.mapHelp} onSelect={(id) => router.push(`/roadsync/work-requests/${id}`)} />
              <p className="rs-help">
                {fmt(mapData.data.features.length === 1 ? lc.countOne : lc.countMany, { n: mapData.data.features.length })} {lc.mapSuffix}
                {mapData.data.truncated ? lc.mapTruncated : ""}
              </p>
            </section>
          )
        ) : list.isPending ? (
          <div className="rs-list" role="status" aria-label={lc.loading}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rs-skel-row" />
            ))}
          </div>
        ) : failure ? (
          <div className="rs-state" role="alert">
            <RouteLines className="rs-state-motif" />
            <h2>{failure === "forbidden" ? lc.forbiddenTitle : lc.failedTitle}</h2>
            <p>{failText(failure)}</p>
            {failure === "unavailable" ? (
              <button type="button" className="rs-btn" onClick={() => void list.refetch()}>
                <RefreshCwIcon aria-hidden="true" />
                {lc.retry}
              </button>
            ) : null}
          </div>
        ) : data && data.workRequests.length === 0 ? (
          <div className="rs-state">
            <RouteLines className="rs-state-motif" />
            <h2>{filtered ? lc.emptyFilteredTitle : lc.emptyNoneTitle}</h2>
            <p>
              {filtered ? lc.emptyFilteredHelp : lc.emptyNoneHelp}
            </p>
            {filtered ? (
              <button type="button" className="rs-btn" onClick={() => setFilters(EMPTY_FILTERS)}>{lc.reset}</button>
            ) : canHintCreate(roleKey) ? (
              <Link href="/roadsync/work-requests/new" className="rs-btn">
                <PlusIcon aria-hidden="true" />
                {lc.create}
              </Link>
            ) : null}
          </div>
        ) : data ? (
          <section className="rs-list" aria-label={lc.title}>
            <div className="rs-list-head" aria-hidden="true">
              <span>{lc.head.work}</span>
              <span>{lc.head.project}</span>
              <span>{lc.head.window}</span>
              <span>{lc.head.priority}</span>
              <span>{lc.head.status}</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {data.workRequests.map((wr) => (
                <li key={wr.id} className="rs-row">
                  <div className="rs-row-main">
                    <WorkTypeIcon type={wr.workType} />
                    <div style={{ minWidth: 0 }}>
                      <Link className="rs-row-link" href={`/roadsync/work-requests/${wr.id}`}>
                        {lc.workTypes[wr.workType]}
                        <span className="mc-sr">{lc.openDetails}</span>
                      </Link>
                      <p className="rs-sub">{wr.geometry.type === "Point" ? lc.geom.Point : wr.geometry.type === "LineString" ? lc.geom.Corridor : lc.geom.Area} · {wr.agencyName ?? lc.agency}{wr.nearbyCount > 0 ? <span className="rs-nb-chip" style={{ marginLeft: "0.5rem" }}>{wr.assessment?.maxBand ? fmt(risk.list.risk, { n: wr.nearbyCount, band: risk.bands[wr.assessment.maxBand as Band] }) : fmt(risk.list.nearbyOnly, { n: wr.nearbyCount })}</span> : null}{wr.assessment?.maxBand ? <span style={{ marginLeft: "0.5rem" }} title={`${risk.riskIndex}: ${wr.assessment.riskIndex}`}><BandPill band={wr.assessment.maxBand as Band} copy={risk} /></span> : null}{wr.conflictRecords && wr.conflictRecords.total > 0 ? <Link href={`/roadsync/conflicts?requestId=${wr.id}`} className="rs-nb-chip" style={{ marginLeft: "0.5rem" }}>{fmt(getConflictCopy(locale).integrations.records, { n: wr.conflictRecords.total })}{wr.conflictRecords.needsAck > 0 ? ` · ${getConflictCopy(locale).integrations.needsAck}` : ""}</Link> : null}</p>
                    </div>
                  </div>
                  <div className="rs-cell">
                    <span className="rs-cell-label">{lc.head.project}</span>
                    {wr.projectTitle ?? "—"}
                    {wr.projectCode ? <p className="rs-sub">{wr.projectCode}</p> : null}
                  </div>
                  <div className="rs-cell rs-cell-window">
                    <span className="rs-cell-label">{lc.head.window}</span>
                    {formatWindow(wr.plannedStart, wr.plannedEnd)}
                  </div>
                  <div className="rs-cell">
                    <span className="rs-cell-label">{lc.head.priority}</span>
                    <PriorityMark priority={wr.priority} label={lc.priorities[wr.priority]} />
                  </div>
                  <div className="rs-cell">
                    <span className="rs-cell-label">{lc.head.status}</span>
                    <StatusChip domain="work" status={wr.status} label={lc.statuses[wr.status]} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="rs-pager">
              <span>
                <RouteIcon aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem", display: "inline", verticalAlign: "-0.15em" }} /> {fmt(data.total === 1 ? lc.countOne : lc.countMany, { n: data.total })} · {fmt(lc.page, { page: data.page, pages })}
              </span>
              <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                <button type="button" className="rs-btn" disabled={filters.page <= 1} onClick={() => setFilters((c) => ({ ...c, page: c.page - 1 }))}>{lc.prev}</button>
                <button type="button" className="rs-btn" disabled={filters.page >= pages} onClick={() => setFilters((c) => ({ ...c, page: c.page + 1 }))}>{lc.next}</button>
              </span>
            </div>
          </section>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}
