"use client";

import { useCallback, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";

import { DataTable, DataTableColumnHeader } from "@/components/data-table/data-table";
import { ProjectStatusBadge } from "@/components/common/status-badge";
import {
  formatLkrMinor,
  PREVIEW_PAGE_SIZES,
  queryMockTablePage,
  type TableQueryState,
} from "@/lib/data-table/query-state";

type DemoRow = {
  id: string;
  name: string;
  status: "DRAFT" | "APPROVED";
  amountMinor: number;
};

const ROWS: DemoRow[] = [
  { id: "syn-1", name: "Synthetic corridor A", status: "DRAFT", amountMinor: 125000 },
  { id: "syn-2", name: "Synthetic corridor B", status: "APPROVED", amountMinor: 980000 },
  { id: "syn-3", name: "Synthetic corridor C", status: "APPROVED", amountMinor: 45000 },
];

const DEMO_SORT_IDS = new Set(["name", "amountMinor"]);

const MOCK_OPTIONS = {
  pageSizeOptions: PREVIEW_PAGE_SIZES,
  search: (row: DemoRow, term: string) => row.name.toLowerCase().includes(term.toLowerCase()),
  sortValue: (row: DemoRow, columnId: string) =>
    columnId === "amountMinor" ? row.amountMinor : row.name,
  allowSortIds: DEMO_SORT_IDS,
} as const;

const columns: ColumnDef<DemoRow, unknown>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => row.original.name,
    enableGlobalFilter: true,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <ProjectStatusBadge status={row.original.status} />,
    enableSorting: false,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "amountMinor",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => (
      <span className="type-tabular-nums">{formatLkrMinor(row.original.amountMinor)}</span>
    ),
    sortingFn: (left, right) => left.original.amountMinor - right.original.amountMinor,
    enableGlobalFilter: false,
  },
];

export function DataTablePreview() {
  const [query, setQuery] = useState<TableQueryState>({
    pageIndex: 0,
    pageSize: 2,
    sorting: [],
    filters: [],
    search: "",
  });
  const page = useMemo(() => queryMockTablePage(ROWS, query, MOCK_OPTIONS), [query]);

  const setTableQuery = useCallback((next: TableQueryState) => {
    const normalized = queryMockTablePage(ROWS, next, MOCK_OPTIONS);
    setQuery({ ...next, pageIndex: normalized.pageIndex });
  }, []);

  return (
    <div className="grid gap-6">
      <DataTable
        columns={columns}
        data={ROWS}
        getRowId={(row) => row.id}
        enableSearch
        enableSelection
        pageSizeOptions={PREVIEW_PAGE_SIZES}
        tableLabel="Client mode synthetic table"
      />
      <DataTable
        mode="server"
        columns={columns}
        data={page.rows}
        getRowId={(row) => row.id}
        enableSearch
        pageSizeOptions={PREVIEW_PAGE_SIZES}
        tableLabel="Server mode synthetic table"
        server={{
          query,
          totalCount: page.totalCount,
          onQueryChange: setTableQuery,
        }}
      />
    </div>
  );
}
