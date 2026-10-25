"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { DataTable } from "@/components/data-table/data-table";
import { fetchProjects } from "@/lib/projects/api";
import { getProjectCopy, projectListMessage } from "@/lib/projects/messages";
import type { ProjectSummary } from "@/lib/projects/types";
import { ApiError } from "@/lib/api/client";
import type { AuthLocale } from "@/lib/auth/types";
import type { TableQueryState } from "@/lib/data-table/query-state";

const PAGE_SIZES = [10, 20] as const;

export function ProjectsPageClient() {
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getProjectCopy(locale);
  const [query, setQuery] = useState<TableQueryState>({
    pageIndex: 0,
    pageSize: 10,
    sorting: [],
    filters: [],
    search: "",
  });

  const list = useQuery({
    queryKey: ["projects", query.pageIndex, query.pageSize, query.search],
    queryFn: () =>
      fetchProjects({
        page: query.pageIndex + 1,
        limit: query.pageSize,
        q: query.search.trim() || undefined,
      }),
    retry: false,
  });

  const columns = useMemo<ColumnDef<ProjectSummary, unknown>[]>(
    () => [
      {
        accessorKey: "projectCode",
        header: "Code",
        cell: ({ row }) => <Link href={`/projects/${row.original.id}/overview`}>{row.original.projectCode}</Link>,
      },
      { accessorKey: "title", header: "Title" },
      { accessorKey: "projectType", header: "Type" },
      { accessorKey: "status", header: "Status" },
      { accessorKey: "agencyCode", header: "Agency" },
      { accessorKey: "startDate", header: "Start" },
      { accessorKey: "plannedEndDate", header: "Planned end" },
    ],
    [],
  );

  const error = list.error instanceof ApiError ? projectListMessage(list.error.status, copy) : list.error ? copy.unavailable : undefined;

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
      <div className="admin-users-table-wrap">
        <DataTable
          columns={columns}
          data={list.data?.projects ?? []}
          getRowId={(row) => row.id}
          mode="server"
          loading={list.isLoading}
          error={error}
          onRetry={() => void list.refetch()}
          enableSearch
          searchPlaceholder="Code or title"
          pageSizeOptions={PAGE_SIZES}
          tableLabel="Scoped projects"
          server={{ query, onQueryChange: setQuery, totalCount: list.data?.total ?? 0 }}
        />
      </div>
      {!list.isLoading && !error && (list.data?.total ?? 0) === 0 ? <p role="status">{copy.empty}</p> : null}
    </StaffWorkspaceShell>
  );
}
