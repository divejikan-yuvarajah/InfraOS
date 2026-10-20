"use client";

import type { Column } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";

export function DataTableColumnHeader<TData>({
  column,
  title,
}: {
  column: Column<TData, unknown>;
  title: string;
}) {
  const sorted = column.getIsSorted();
  if (!column.getCanSort()) {
    return <span>{title}</span>;
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2"
      onClick={() => {
        if (!sorted) column.toggleSorting(false);
        else if (sorted === "asc") column.toggleSorting(true);
        else column.clearSorting();
      }}
    >
      {title}
      <span className="sr-only">
        {sorted === "asc" ? ", sorted ascending" : sorted === "desc" ? ", sorted descending" : ", not sorted"}
      </span>
    </Button>
  );
}
