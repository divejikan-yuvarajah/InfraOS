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
import { classifyWorkRequestError, fetchWorkRequestMap, fetchWorkRequests, FAILURE_COPY } from "@/lib/roadsync/api";
import {
  canHintCreate,
  ELIGIBLE_PROJECT_STATUSES,
  EMPTY_FILTERS,
  filtersToQuery,
  formatWindow,
  hasActiveFilters,
  PRIORITY_LABELS,
  statusLabel,
  WORK_PRIORITIES,
  WORK_STATUSES,
  WORK_TYPE_LABELS,
  WORK_TYPES,
  workRequestQueryKey,
  type WorkRequestFilters,
} from "@/lib/roadsync/work-requests-view";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";

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
    <StaffWorkspaceShell title="Work Requests" description="Planned road and utility works in your authorised scope. Requests start as drafts; conflict detection is not available yet." wide>
      <div className="rs-page">
        <div className="rs-eyebrow">
          <p className="rs-crumb">Operations / RoadSync</p>
          <div className="rs-seg rs-view" role="group" aria-label="View">
            <button type="button" className="rs-btn" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
            <button type="button" className="rs-btn" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>
          </div>
          {canHintCreate(roleKey) ? (
            <Link href="/roadsync/work-requests/new" className="rs-btn is-primary">
              <PlusIcon aria-hidden="true" />
              Create work request
            </Link>
          ) : null}
        </div>

        {data ? (
          <section className="rs-tiles" aria-label="Work request summary">
            <div className="rs-tile" style={{ ["--rs-accent" as string]: "var(--infra-orange)" }}>
              <p className="rs-tile-label">In your scope</p>
              <p className="rs-tile-value">{scopeTotal}</p>
              <p className="rs-tile-note">all statuses</p>
            </div>
            <div className="rs-tile" style={{ ["--rs-accent" as string]: "#94a3b8" }}>
              <p className="rs-tile-label">Drafts</p>
              <p className="rs-tile-value">{byStatus.DRAFT ?? 0}</p>
              <p className="rs-tile-note">not yet submitted</p>
            </div>
            <div className="rs-tile" style={{ ["--rs-accent" as string]: "var(--infra-yellow, #feb600)" }}>
              <p className="rs-tile-label">High or critical</p>
              <p className="rs-tile-value">{urgent}</p>
              <p className="rs-tile-note">by requested priority</p>
            </div>
          </section>
        ) : null}

        <form className="rs-filters" aria-label="Filter work requests" onSubmit={(e) => e.preventDefault()}>
          <label className="rs-field">
            <span className="rs-label">Status</span>
            <select className="rs-input" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="">All statuses</option>
              {WORK_STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </label>
          <label className="rs-field">
            <span className="rs-label">Work type</span>
            <select className="rs-input" value={filters.workType} onChange={(e) => set({ workType: e.target.value })}>
              <option value="">All work types</option>
              {WORK_TYPES.map((t) => (
                <option key={t} value={t}>{WORK_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>
          <label className="rs-field">
            <span className="rs-label">Priority</span>
            <select className="rs-input" value={filters.priority} onChange={(e) => set({ priority: e.target.value })}>
              <option value="">All priorities</option>
              {WORK_PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </label>
          <label className="rs-nb-check">
            <input type="checkbox" checked={Boolean(filters.hasCandidates)} onChange={(e) => set({ hasCandidates: e.target.checked })} />
            Has nearby activity
          </label>
          {projects.data ? (
            <label className="rs-field">
              <span className="rs-label">Project</span>
              <select className="rs-input" value={filters.projectId} onChange={(e) => set({ projectId: e.target.value })}>
                <option value="">All projects</option>
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
              Reset filters
            </button>
          ) : null}
        </form>

        {view === "map" ? (
          mapData.isPending ? (
            <div className="rs-skel-row" role="status" aria-label="Loading map" style={{ height: 420 }} />
          ) : mapData.isError ? (
            <div className="rs-state" role="alert">
              <h2>The map could not be loaded</h2>
              <p>{FAILURE_COPY[classifyWorkRequestError(mapData.error)]}</p>
              <button type="button" className="rs-btn" onClick={() => void mapData.refetch()}><RefreshCwIcon aria-hidden="true" />Try again</button>
            </div>
          ) : (
            <section aria-label="Work requests map">
              <WorkMap features={mapData.data.features} height={460} label="Map of work requests in your scope. Select a shape to open it." onSelect={(id) => router.push(`/roadsync/work-requests/${id}`)} />
              <p className="rs-help">
                {mapData.data.features.length} {mapData.data.features.length === 1 ? "work request" : "work requests"} on the map
                {mapData.data.truncated ? " (first 1,000 only; narrow the filters)" : ""}. Dashed = draft. Select a shape to open it.
              </p>
            </section>
          )
        ) : list.isPending ? (
          <div className="rs-list" role="status" aria-label="Loading work requests">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rs-skel-row" />
            ))}
          </div>
        ) : failure ? (
          <div className="rs-state" role="alert">
            <RouteLines className="rs-state-motif" />
            <h2>{failure === "forbidden" ? "Work requests are not available to your role" : "Work requests could not be loaded"}</h2>
            <p>{FAILURE_COPY[failure]}</p>
            {failure === "unavailable" ? (
              <button type="button" className="rs-btn" onClick={() => void list.refetch()}>
                <RefreshCwIcon aria-hidden="true" />
                Try again
              </button>
            ) : null}
          </div>
        ) : data && data.workRequests.length === 0 ? (
          <div className="rs-state">
            <RouteLines className="rs-state-motif" />
            <h2>{filtered ? "No work requests match these filters" : "No work requests yet"}</h2>
            <p>
              {filtered
                ? "Try a different status, type or priority, or reset the filters."
                : "Work requests describe planned works on a project, with a location and a schedule. Create the first draft to start coordinating."}
            </p>
            {filtered ? (
              <button type="button" className="rs-btn" onClick={() => setFilters(EMPTY_FILTERS)}>Reset filters</button>
            ) : canHintCreate(roleKey) ? (
              <Link href="/roadsync/work-requests/new" className="rs-btn">
                <PlusIcon aria-hidden="true" />
                Create work request
              </Link>
            ) : null}
          </div>
        ) : data ? (
          <section className="rs-list" aria-label="Work requests">
            <div className="rs-list-head" aria-hidden="true">
              <span>Work</span>
              <span>Project</span>
              <span>Planned window (Colombo)</span>
              <span>Priority</span>
              <span>Status</span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {data.workRequests.map((wr) => (
                <li key={wr.id} className="rs-row">
                  <div className="rs-row-main">
                    <WorkTypeIcon type={wr.workType} />
                    <div style={{ minWidth: 0 }}>
                      <Link className="rs-row-link" href={`/roadsync/work-requests/${wr.id}`}>
                        {WORK_TYPE_LABELS[wr.workType]}
                        <span className="mc-sr"> — open details</span>
                      </Link>
                      <p className="rs-sub">{wr.geometry.type === "Point" ? "Point" : wr.geometry.type === "LineString" ? "Corridor" : "Area"} · {wr.agencyName ?? "Agency"}{wr.nearbyCount > 0 ? <span className="rs-nb-chip" style={{ marginLeft: "0.5rem" }}>{wr.nearbyCount} nearby</span> : null}</p>
                    </div>
                  </div>
                  <div className="rs-cell">
                    <span className="rs-cell-label">Project</span>
                    {wr.projectTitle ?? "—"}
                    {wr.projectCode ? <p className="rs-sub">{wr.projectCode}</p> : null}
                  </div>
                  <div className="rs-cell rs-cell-window">
                    <span className="rs-cell-label">Planned window</span>
                    {formatWindow(wr.plannedStart, wr.plannedEnd)}
                  </div>
                  <div className="rs-cell">
                    <span className="rs-cell-label">Priority</span>
                    <PriorityMark priority={wr.priority} />
                  </div>
                  <div className="rs-cell">
                    <span className="rs-cell-label">Status</span>
                    <StatusChip domain="work" status={wr.status} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="rs-pager">
              <span>
                <RouteIcon aria-hidden="true" style={{ width: "0.9rem", height: "0.9rem", display: "inline", verticalAlign: "-0.15em" }} /> {data.total} {data.total === 1 ? "work request" : "work requests"} · page {data.page} of {pages}
              </span>
              <span style={{ display: "inline-flex", gap: "0.5rem" }}>
                <button type="button" className="rs-btn" disabled={filters.page <= 1} onClick={() => setFilters((c) => ({ ...c, page: c.page - 1 }))}>Previous</button>
                <button type="button" className="rs-btn" disabled={filters.page >= pages} onClick={() => setFilters((c) => ({ ...c, page: c.page + 1 }))}>Next</button>
              </span>
            </div>
          </section>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}
