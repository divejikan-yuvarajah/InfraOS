"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { useId, useMemo, useState } from "react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { createDataTableSelectionColumn } from "@/components/data-table/data-table-selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  clampPageSize,
  DEFAULT_PAGE_SIZES,
  type TableQueryState,
} from "@/lib/data-table/query-state";

export type DataTableServerState = {
  query: TableQueryState;
  onQueryChange: (query: TableQueryState) => void;
  totalCount?: number;
  hasNextPage?: boolean;
};

function optInGlobalFilterFn<TData>(
  row: Row<TData>,
  _columnId: string,
  filterValue: unknown,
): boolean {
  const term = String(filterValue ?? "")
    .trim()
    .toLowerCase();
  if (!term) return true;
  return row.getVisibleCells().some((cell) => {
    if (cell.column.columnDef.enableGlobalFilter !== true) return false;
    const value = cell.getValue();
    return String(value ?? "")
      .toLowerCase()
      .includes(term);
  });
}

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  mode = "client",
  loading = false,
  error,
  onRetry,
  searchPlaceholder = "Search",
  enableSearch = false,
  enableSelection = false,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  tableLabel = "Data table",
  server,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: readonly TData[];
  getRowId: (row: TData) => string;
  mode?: "client" | "server";
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  searchPlaceholder?: string;
  enableSearch?: boolean;
  enableSelection?: boolean;
  pageSizeOptions?: readonly number[];
  tableLabel?: string;
  server?: DataTableServerState;
}) {
  const searchInputId = useId();
  const pageSizeSelectId = useId();
  const [sorting, setSorting] = useState<TableQueryState["sorting"]>([]);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0] ?? 10);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const isServer = mode === "server";
  const query = isServer && server ? server.query : { pageIndex, pageSize, sorting, filters: [], search };
  const effectivePageSize = clampPageSize(query.pageSize, pageSizeOptions);

  const resolvedColumns = useMemo(
    () =>
      enableSelection
        ? [createDataTableSelectionColumn<TData>(), ...columns]
        : columns,
    [columns, enableSelection],
  );

  const table = useReactTable({
    data: [...data],
    columns: resolvedColumns,
    state: {
      sorting: query.sorting,
      globalFilter: enableSearch ? query.search : undefined,
      pagination: { pageIndex: query.pageIndex, pageSize: effectivePageSize },
      rowSelection,
    },
    enableRowSelection: enableSelection,
    manualPagination: isServer,
    manualSorting: isServer,
    manualFiltering: isServer,
    pageCount:
      isServer && server?.totalCount != null
        ? server.totalCount === 0
          ? 0
          : Math.ceil(server.totalCount / effectivePageSize)
        : undefined,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(query.sorting) : updater;
      updateQuery({ sorting: next, pageIndex: 0 });
    },
    onGlobalFilterChange: (value) => updateQuery({ search: String(value), pageIndex: 0 }),
    onPaginationChange: (updater) => {
      const current = { pageIndex: query.pageIndex, pageSize: effectivePageSize };
      const next = typeof updater === "function" ? updater(current) : updater;
      updateQuery({
        pageIndex: next.pageIndex,
        pageSize: clampPageSize(next.pageSize, pageSizeOptions),
      });
    },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => getRowId(row),
    globalFilterFn: optInGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: isServer ? undefined : getSortedRowModel(),
    getFilteredRowModel: isServer ? undefined : getFilteredRowModel(),
    getPaginationRowModel: isServer ? undefined : getPaginationRowModel(),
  });

  function updateQuery(patch: Partial<TableQueryState>) {
    const next = { ...query, filters: query.filters ?? [], ...patch };
    if (patch.pageSize != null) {
      next.pageSize = clampPageSize(patch.pageSize, pageSizeOptions);
    }
    if (isServer && server) server.onQueryChange(next);
    else {
      setSorting(next.sorting);
      setSearch(next.search);
      setPageIndex(next.pageIndex);
      setPageSize(next.pageSize);
    }
  }

  const hasActiveSearch = query.search.trim().length > 0;
  const clientFilteredCount = table.getFilteredRowModel().rows.length;
  const serverTotal = server?.totalCount ?? 0;
  const isEmptyDataset =
    !loading &&
    !error &&
    (isServer ? serverTotal === 0 && !hasActiveSearch : data.length === 0);
  const isFilteredEmpty =
    !loading &&
    !error &&
    (isServer
      ? serverTotal === 0 && hasActiveSearch
      : data.length > 0 && clientFilteredCount === 0);

  function clearFilters() {
    updateQuery({ search: "", pageIndex: 0, sorting: [], filters: [] });
  }

  return (
    <div className="grid gap-3" aria-busy={loading || undefined}>
      {enableSearch ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid max-w-xs flex-1 gap-1">
            <Label htmlFor={searchInputId}>Search</Label>
            <Input
              id={searchInputId}
              value={query.search}
              placeholder={searchPlaceholder}
              onChange={(event) => updateQuery({ search: event.target.value, pageIndex: 0 })}
            />
          </div>
          {hasActiveSearch ? (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Clear search
            </Button>
          ) : null}
        </div>
      ) : null}
      <div
        className="overflow-x-auto rounded-lg border border-border"
        tabIndex={0}
        role="region"
        aria-label={`${tableLabel} horizontal scroll`}
      >
        <DataTableView
          table={table}
          loading={loading}
          error={error}
          onRetry={onRetry}
          tableLabel={tableLabel}
          isEmptyDataset={isEmptyDataset}
          isFilteredEmpty={isFilteredEmpty}
          onClearFilters={hasActiveSearch ? clearFilters : undefined}
        />
      </div>
      <DataTablePagination
        pageIndex={query.pageIndex}
        pageSize={effectivePageSize}
        totalCount={
          isServer ? server?.totalCount : table.getFilteredRowModel().rows.length
        }
        hasNextPage={server?.hasNextPage}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={(next) => updateQuery({ pageSize: next, pageIndex: 0 })}
        onPageIndexChange={(next) => updateQuery({ pageIndex: next })}
        pageSizeSelectId={pageSizeSelectId}
      />
      {enableSelection ? (
        <p className="type-caption text-text-secondary">
          {Object.keys(rowSelection).length} selected on this page. Selection does not grant
          permission.
        </p>
      ) : null}
    </div>
  );
}

function DataTableView<TData>({
  table,
  loading,
  error,
  onRetry,
  tableLabel,
  isEmptyDataset,
  isFilteredEmpty,
  onClearFilters,
}: {
  table: TanstackTable<TData>;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  tableLabel: string;
  isEmptyDataset: boolean;
  isFilteredEmpty: boolean;
  onClearFilters?: () => void;
}) {
  const columns = table.getVisibleLeafColumns().length;
  return (
    <Table aria-label={tableLabel}>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              return (
                <TableHead
                  key={header.id}
                  scope="col"
                  aria-sort={
                    sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {error ? (
          <TableRow>
            <TableCell colSpan={columns}>
              <p>{error}</p>
              {onRetry ? (
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ) : loading ? (
          <TableRow>
            <TableCell colSpan={columns}>Loading rows…</TableCell>
          </TableRow>
        ) : table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns}>
              <div className="space-y-2 py-2">
                <p>
                  {isFilteredEmpty
                    ? "No records match these filters."
                    : isEmptyDataset
                      ? "No records available."
                      : "No matching rows."}
                </p>
                {isFilteredEmpty && onClearFilters ? (
                  <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} data-label={(cell.column.columnDef.meta as { label?: string } | undefined)?.label}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export { DataTableColumnHeader };
