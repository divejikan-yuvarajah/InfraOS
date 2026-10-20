"use client";

import type { ColumnDef } from "@tanstack/react-table";

export function createDataTableSelectionColumn<TData>(
  rowLabel: (row: TData) => string = (row) => {
    const value = row as { id?: string; name?: string };
    return value.name ?? value.id ?? "row";
  },
): ColumnDef<TData, unknown> {
  return {
    id: "select",
    enableSorting: false,
    enableGlobalFilter: false,
    header: ({ table }) => (
      <input
        type="checkbox"
        className="size-4 rounded border-border accent-infra-orange"
        aria-label="Select all rows on this page"
        checked={table.getIsAllPageRowsSelected()}
        ref={(element) => {
          if (!element) return;
          element.indeterminate =
            table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
        }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="size-4 rounded border-border accent-infra-orange"
        aria-label={`Select ${rowLabel(row.original)}`}
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
  };
}
