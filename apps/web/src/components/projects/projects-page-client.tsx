"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { ContextBar, StatusChip } from "@/components/site-plan/site-plan";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { TableQueryState } from "@/lib/data-table/query-state";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { fetchProjects } from "@/lib/projects/api";
import { getDashboardCopy } from "@/lib/projects/dashboard-messages";
import { dashboardStatusLabel } from "@/lib/projects/dashboard-view";
import {
  canHintProjectCreate,
  EMPTY_PROJECT_LIST_STATE,
  parseProjectListParams,
  PROJECT_LIST_PAGE_SIZES,
  PROJECT_LIST_SORTS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  resetProjectListPage,
  serializeProjectListParams,
  toProjectListRequest,
  type ProjectListState,
} from "@/lib/projects/list-query";
import { getProjectCopy, projectListMessage } from "@/lib/projects/messages";
import { projectListQueryKey, utcDateLabel } from "@/lib/projects/overview-format";
import { getReviewCopy } from "@/lib/projects/review-messages";
import type { ProjectSummary } from "@/lib/projects/types";

import "@/styles/site-plan-projects.css";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

type Density = "comfortable" | "compact";

export function ProjectsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const [locale] = useWorkspaceLocale();
  const copy = getProjectCopy(locale);
  const dash = getDashboardCopy(locale);
  const statusName = (status: string) => dashboardStatusLabel(status, dash);
  const [density, setDensity] = useState<Density>("comfortable");
  const serialized = searchParams.toString();
  const urlState = useMemo(() => parseProjectListParams(new URLSearchParams(serialized)), [serialized]);
  const [state, setState] = useState<ProjectListState>(urlState);
  const [trackedUrl, setTrackedUrl] = useState(serialized);
  const [searchDraft, setSearchDraft] = useState(urlState.q);
  if (trackedUrl !== serialized) {
    setTrackedUrl(serialized);
    setState(urlState);
    setSearchDraft(urlState.q);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setState((current) => (current.q === searchDraft ? current : resetProjectListPage(current, { q: searchDraft })));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchDraft]);

  useEffect(() => {
    const next = serializeProjectListParams(state);
    if (next === serialized) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, serialized, state]);

  const list = useQuery({
    queryKey: projectListQueryKey(epoch, userId, roleKey, serializeProjectListParams(state)),
    queryFn: () => fetchProjects(toProjectListRequest(state)),
    retry: false,
  });

  const listQuery = serializeProjectListParams(state);

  const columns = useMemo<ColumnDef<ProjectSummary, unknown>[]>(
    () => [
      {
        accessorKey: "projectCode",
        meta: { label: copy.columnCode },
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnCode} />,
        cell: ({ row }) => (
          <Link className="spl-code" href={`/projects/${row.original.id}/overview${listQuery ? `?list=${encodeURIComponent(listQuery)}` : ""}`}>
            {row.original.projectCode}
          </Link>
        ),
      },
      {
        accessorKey: "title",
        meta: { label: copy.columnTitle },
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnTitle} />,
        cell: ({ row }) => <span className="spl-title">{row.original.title}</span>,
      },
      {
        accessorKey: "projectType",
        meta: { label: copy.columnType },
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnType} />,
        cell: ({ row }) => <span className="spp-tag">{copy.types[row.original.projectType as keyof typeof copy.types] ?? row.original.projectType}</span>,
      },
      {
        accessorKey: "status",
        meta: { label: copy.columnStatus },
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnStatus} />,
        cell: ({ row }) => <StatusChip domain="project" status={row.original.status} label={statusName(row.original.status)} />,
      },
      {
        accessorKey: "agencyCode",
        meta: { label: copy.columnAgency },
        enableSorting: false,
        header: copy.columnAgency,
        cell: ({ row }) => row.original.agencyCode ?? row.original.agencyId,
      },
      {
        accessorKey: "startDate",
        meta: { label: copy.columnStart },
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnStart} />,
        cell: ({ row }) => <span className="spl-date">{utcDateLabel(row.original.startDate, "—")}</span>,
      },
      {
        accessorKey: "plannedEndDate",
        meta: { label: copy.columnEnd },
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnEnd} />,
        cell: ({ row }) => <span className="spl-date">{utcDateLabel(row.original.plannedEndDate, "—")}</span>,
      },
    ],
    // statusName depends only on `dash`, which is derived from `locale`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [copy, listQuery, locale],
  );

  const tableQuery: TableQueryState = {
    pageIndex: Math.max(0, state.page - 1),
    pageSize: state.limit,
    sorting: [{ id: state.sortBy, desc: state.sortDir === "desc" }],
    filters: [],
    search: state.q,
  };
  const filtered = Boolean(state.q || state.status || state.type || state.agencyId);
  const error = list.error instanceof ApiError ? projectListMessage(list.error.status, copy) : list.error ? copy.unavailable : undefined;
  const agencies = list.data?.agencies ?? [];
  const total = list.data?.total ?? 0;

  return (
    <StaffWorkspaceShell
      title={copy.title}
      description={copy.subtitle}
      wide
      context={
        <ContextBar
          crumbs={[{ label: copy.breadcrumbWorkspace, href: "/dashboard" }, { label: copy.breadcrumbProjects }]}
          actions={
            <>
              {roleKey === "GOV_ADMIN" ? (
                <Link className="spp-btn" href="/projects/reviews">
                  {getReviewCopy(locale).title}
                </Link>
              ) : null}
              {canHintProjectCreate(roleKey) ? (
                <Link className="spp-btn is-primary" href="/projects/new">
                  {copy.createProject}
                </Link>
              ) : null}
            </>
          }
        />
      }
    >
      <div className="spl">
        {locale !== "en" ? <p className="spp-small">{copy.nativeReview}</p> : null}
        <form className="sp-surface spl-filters" aria-label={copy.title} onSubmit={(event) => event.preventDefault()}>
          <div className="spl-field">
            <label htmlFor="project-search">{copy.searchLabel}</label>
            <input id="project-search" className="spp-input" value={searchDraft} maxLength={80} onChange={(event) => setSearchDraft(event.target.value)} />
          </div>
          <div className="spl-field">
            <label htmlFor="project-status">{copy.statusFilter}</label>
            <select id="project-status" className="spp-input" value={state.status} onChange={(event) => setState((current) => resetProjectListPage(current, { status: event.target.value }))}>
              <option value="">{copy.anyStatus}</option>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusName(status)}
                </option>
              ))}
            </select>
          </div>
          <div className="spl-field">
            <label htmlFor="project-type">{copy.typeFilter}</label>
            <select id="project-type" className="spp-input" value={state.type} onChange={(event) => setState((current) => resetProjectListPage(current, { type: event.target.value }))}>
              <option value="">{copy.anyType}</option>
              {PROJECT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {copy.types[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="spl-field">
            <label htmlFor="project-agency">{copy.agencyFilter}</label>
            <select id="project-agency" className="spp-input" value={state.agencyId} onChange={(event) => setState((current) => resetProjectListPage(current, { agencyId: event.target.value }))}>
              <option value="">{copy.anyAgency}</option>
              {state.agencyId && !agencies.some((agency) => agency.id === state.agencyId) ? <option value={state.agencyId}>{state.agencyId}</option> : null}
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.code ?? agency.id}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="spp-btn"
            onClick={() => {
              setSearchDraft("");
              setState(EMPTY_PROJECT_LIST_STATE);
            }}
          >
            {copy.clearFilters}
          </button>
        </form>

        <div className="spl-bar">
          <p className="spl-count" role="status">
            {!list.isLoading && !error ? `${total} ${copy.title.toLowerCase()}` : " "}
          </p>
          <div className="spl-density" role="group" aria-label="Row density">
            {(["comfortable", "compact"] as const).map((item) => (
              <button key={item} type="button" aria-pressed={density === item} className={density === item ? "is-current" : undefined} onClick={() => setDensity(item)}>
                {item === "comfortable" ? "Comfortable" : "Compact"}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-users-table-wrap">
          <DataTable
            columns={columns}
            data={list.data?.projects ?? []}
            getRowId={(row) => row.id}
            mode="server"
            density={density}
            loading={list.isLoading}
            error={error}
            onRetry={() => void list.refetch()}
            pageSizeOptions={PROJECT_LIST_PAGE_SIZES}
            tableLabel={copy.title}
            server={{
              query: tableQuery,
              totalCount: total,
              onQueryChange: (next) => {
                const sort = next.sorting[0];
                const sortBy = PROJECT_LIST_SORTS.find((field) => field === sort?.id);
                setState((current) => ({
                  ...current,
                  page: next.pageIndex + 1,
                  limit: next.pageSize === 20 ? 20 : 10,
                  sortBy: sortBy ?? "createdAt",
                  sortDir: sort ? (sort.desc ? "desc" : "asc") : "desc",
                }));
              },
            }}
          />
        </div>
        {!list.isLoading && !error && total === 0 ? (
          <p className="sp-surface spp-small" style={{ padding: "1rem 1.25rem" }} role="status">
            {filtered ? copy.noMatch : copy.empty}
          </p>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}
