"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { ProjectStatusBadge } from "@/components/common/status-badge";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { ApiError } from "@/lib/api/client";
import type { AuthLocale } from "@/lib/auth/types";
import { getAuthEpoch, getMemorySession, subscribeAuth } from "@/lib/auth/state";
import type { TableQueryState } from "@/lib/data-table/query-state";
import { fetchReviewQueue } from "@/lib/projects/api";
import { reviewQueueQueryKey } from "@/lib/projects/overview-format";
import { getReviewCopy, reviewFailureMessage } from "@/lib/projects/review-messages";
import {
  EMPTY_REVIEW_QUEUE,
  REVIEW_QUEUE_PAGE_SIZES,
  REVIEW_QUEUE_SORTS,
  REVIEW_QUEUE_STATUSES,
  parseReviewQueue,
  serializeReviewQueue,
  type ReviewQueueState,
} from "@/lib/projects/review-query";
import type { ProjectSummary } from "@/lib/projects/types";
import type { ProjectStatus } from "@/lib/projects/list-query";

function useAuthPart(read: () => string): string {
  return useSyncExternalStore(subscribeAuth, read, () => "");
}

export function ReviewQueueClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const roleKey = useAuthPart(() => getMemorySession()?.user.roleKey ?? "");
  const userId = useAuthPart(() => getMemorySession()?.user.id ?? "");
  const epoch = useAuthPart(() => String(getAuthEpoch()));
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getReviewCopy(locale);
  const serialized = searchParams.toString();
  const urlState = useMemo(() => parseReviewQueue(new URLSearchParams(serialized)), [serialized]);
  const [state, setState] = useState<ReviewQueueState>(urlState);
  const [trackedUrl, setTrackedUrl] = useState(serialized);
  const [searchDraft, setSearchDraft] = useState(urlState.q);
  if (trackedUrl !== serialized) {
    setTrackedUrl(serialized);
    setState(urlState);
    setSearchDraft(urlState.q);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setState((current) => (current.q === searchDraft ? current : { ...current, page: 1, q: searchDraft }));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchDraft]);

  useEffect(() => {
    const next = serializeReviewQueue(state);
    if (next === serialized) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, serialized, state]);

  const list = useQuery({
    queryKey: reviewQueueQueryKey(epoch, userId, roleKey, serializeReviewQueue(state)),
    queryFn: () => fetchReviewQueue(state),
    retry: false,
    enabled: roleKey === "GOV_ADMIN",
  });

  const columns = useMemo<ColumnDef<ProjectSummary, unknown>[]>(
    () => [
      {
        accessorKey: "projectCode",
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnCode} />,
        cell: ({ row }) => <Link href={`/projects/${row.original.id}/review`}>{row.original.projectCode}</Link>,
      },
      {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title={copy.columnTitle} />,
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
        id: "review",
        enableSorting: false,
        header: copy.openReview,
        cell: ({ row }) => (
          <Link className="auth-access-link" href={`/projects/${row.original.id}/review`}>
            <ClipboardCheck aria-hidden="true" size={16} /> {copy.openReview}
          </Link>
        ),
      },
    ],
    [copy],
  );

  const tableQuery: TableQueryState = {
    pageIndex: Math.max(0, state.page - 1),
    pageSize: state.limit,
    sorting: [{ id: state.sortBy, desc: state.sortDir === "desc" }],
    filters: [],
    search: state.q,
  };
  const filtered = Boolean(state.q || state.status || state.agencyId);
  const error = roleKey && roleKey !== "GOV_ADMIN"
    ? copy.forbidden
    : list.error instanceof ApiError
      ? reviewFailureMessage(list.error.status, copy)
      : list.error
        ? copy.unavailable
        : undefined;
  const agencies = list.data?.agencies ?? [];

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
      <p><Link href="/projects">{copy.backToProjects}</Link></p>
      <section className="auth-access-card" aria-labelledby="review-locale">
        <p id="review-locale" className="auth-access-field-label">View language (draft)</p>
        <div className="auth-access-locale-row" role="group" aria-label="Review language">
          {(["en", "si", "ta"] as const).map((code) => (
            <button key={code} type="button" className="auth-access-button" aria-pressed={locale === code} onClick={() => setLocale(code)}>
              {code === "en" ? "English" : code === "si" ? "සිංහල" : "தமிழ்"}
            </button>
          ))}
        </div>
        <p className="auth-access-status" role="note">{copy.nativeReview}</p>
      </section>
      <section className="auth-access-card" aria-label="Review counts">
        <p>{copy.submittedCount}: {list.data?.counts.submitted ?? "—"}</p>
        <p>{copy.underReviewCount}: {list.data?.counts.underReview ?? "—"}</p>
      </section>
      <form className="project-list-filters" aria-label={copy.title} onSubmit={(event) => event.preventDefault()}>
        <div>
          <label className="auth-access-field-label" htmlFor="review-search">{copy.searchLabel}</label>
          <input id="review-search" className="auth-access-input" value={searchDraft} maxLength={80} onChange={(event) => setSearchDraft(event.target.value)} />
        </div>
        <div>
          <label className="auth-access-field-label" htmlFor="review-status">{copy.statusFilter}</label>
          <select id="review-status" className="auth-access-input" value={state.status} onChange={(event) => setState((current) => ({ ...current, page: 1, status: event.target.value as ReviewQueueState["status"] }))}>
            <option value="">{copy.anyStatus}</option>
            {REVIEW_QUEUE_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
        </div>
        <div>
          <label className="auth-access-field-label" htmlFor="review-agency">{copy.agencyFilter}</label>
          <select id="review-agency" className="auth-access-input" value={state.agencyId} onChange={(event) => setState((current) => ({ ...current, page: 1, agencyId: event.target.value }))}>
            <option value="">{copy.anyAgency}</option>
            {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.code ?? agency.id}</option>)}
          </select>
        </div>
        <button type="button" className="auth-access-link" onClick={() => { setSearchDraft(""); setState(EMPTY_REVIEW_QUEUE); }}>{copy.clearFilters}</button>
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
          pageSizeOptions={[...REVIEW_QUEUE_PAGE_SIZES]}
          tableLabel={copy.title}
          server={{
            query: tableQuery,
            totalCount: list.data?.total ?? 0,
            onQueryChange: (next) => {
              const sort = next.sorting[0];
              const sortBy = REVIEW_QUEUE_SORTS.find((field) => field === sort?.id);
              setState((current) => ({
                ...current,
                page: next.pageIndex + 1,
                limit: next.pageSize === 25 ? 25 : 10,
                sortBy: sortBy ?? "updatedAt",
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
