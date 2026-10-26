"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { PROJECT_STATUSES, PROJECT_TYPES, type ProjectStatus } from "@/lib/projects/list-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ProjectStatusBadge } from "@/components/common/status-badge";
import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTable } from "@/components/data-table/data-table";
import { fetchProjects } from "@/lib/projects/api";
import {
  canHintProjectCreate,
  EMPTY_PROJECT_LIST_STATE,
  parseProjectListParams,
  PROJECT_LIST_PAGE_SIZES,
  PROJECT_LIST_SORTS,
  resetProjectListPage,
  serializeProjectListParams,
  toProjectListRequest,
  type ProjectListState,
} from "@/lib/projects/list-query";
import { getProjectCopy, projectListMessage } from "@/lib/projects/messages";
import type { ProjectSummary } from "@/lib/projects/types";
import { ApiError } from "@/lib/api/client";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";
import type { TableQueryState } from "@/lib/data-table/query-state";
import { projectListQueryKey } from "@/lib/projects/overview-format";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

export function ProjectsPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getProjectCopy(locale);
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
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnCode} />,
        cell: ({ row }) => (
          <Link href={`/projects/${row.original.id}/overview${listQuery ? `?list=${encodeURIComponent(listQuery)}` : ""}`}>
            {row.original.projectCode}
          </Link>
        ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnTitle} />,
      },
      {
        accessorKey: "projectType",
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnType} />,
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnStatus} />,
        cell: ({ row }) => <ProjectStatusBadge status={row.original.status as ProjectStatus} />,
      },
      {
        accessorKey: "agencyCode",
        enableSorting: false,
        header: copy.columnAgency,
        cell: ({ row }) => row.original.agencyCode ?? row.original.agencyId,
      },
      {
        accessorKey: "startDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnStart} />,
        cell: ({ row }) => row.original.startDate?.slice(0, 10) ?? "—",
      },
      {
        accessorKey: "plannedEndDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnEnd} />,
        cell: ({ row }) => row.original.plannedEndDate?.slice(0, 10) ?? "—",
      },
    ],
    [copy, listQuery],
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

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
      <section className="auth-access-card" aria-labelledby="project-locale">
        <p id="project-locale" className="auth-access-field-label">View language (draft)</p>
        <div className="auth-access-locale-row" role="group" aria-label="Project language">
          {(["en", "si", "ta"] as const).map((code) => (
            <button key={code} type="button" className="auth-access-button" aria-pressed={locale === code} onClick={() => setLocale(code)}>
              {code.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="auth-access-status" role="status">{copy.nativeReview}</p>
      </section>
      {canHintProjectCreate(roleKey) ? (
        <p>
          <Link className="auth-access-button" href="/projects/new">{copy.createProject}</Link>
        </p>
      ) : null}
      <form className="project-list-filters" aria-label={copy.title} onSubmit={(event) => event.preventDefault()}>
        <div>
          <label className="auth-access-field-label" htmlFor="project-search">{copy.searchLabel}</label>
          <input id="project-search" className="auth-access-input" value={searchDraft} maxLength={80} onChange={(event) => setSearchDraft(event.target.value)} />
        </div>
        <div>
          <label className="auth-access-field-label" htmlFor="project-status">{copy.statusFilter}</label>
          <select id="project-status" className="auth-access-input" value={state.status} onChange={(event) => setState((current) => resetProjectListPage(current, { status: event.target.value }))}>
            <option value="">{copy.anyStatus}</option>
            {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="auth-access-field-label" htmlFor="project-type">{copy.typeFilter}</label>
          <select id="project-type" className="auth-access-input" value={state.type} onChange={(event) => setState((current) => resetProjectListPage(current, { type: event.target.value }))}>
            <option value="">{copy.anyType}</option>
            {PROJECT_TYPES.map((type) => <option key={type} value={type}>{copy.types[type]}</option>)}
          </select>
        </div>
        <div>
          <label className="auth-access-field-label" htmlFor="project-agency">{copy.agencyFilter}</label>
          <select id="project-agency" className="auth-access-input" value={state.agencyId} onChange={(event) => setState((current) => resetProjectListPage(current, { agencyId: event.target.value }))}>
            <option value="">{copy.anyAgency}</option>
            {state.agencyId && !agencies.some((agency) => agency.id === state.agencyId) ? <option value={state.agencyId}>{state.agencyId}</option> : null}
            {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.code ?? agency.id}</option>)}
          </select>
        </div>
        <button type="button" className="auth-access-link" onClick={() => { setSearchDraft(""); setState(EMPTY_PROJECT_LIST_STATE); }}>{copy.clearFilters}</button>
      </form>
      <div className="admin-users-table-wrap">
        <DataTable
          columns={columns}
          data={list.data?.projects ?? []}
          getRowId={(row) => row.id}
          mode="server"
          loading={list.isLoading}
          error={error}
          onRetry={() => void list.refetch()}
          pageSizeOptions={PROJECT_LIST_PAGE_SIZES}
          tableLabel={copy.title}
          server={{
            query: tableQuery,
            totalCount: list.data?.total ?? 0,
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
      {!list.isLoading && !error && (list.data?.total ?? 0) === 0 ? <p role="status">{filtered ? copy.noMatch : copy.empty}</p> : null}
    </StaffWorkspaceShell>
  );
}
