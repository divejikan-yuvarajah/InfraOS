"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pageCount } from "@/lib/data-table/query-state";

export function DataTablePagination({
  pageIndex,
  pageSize,
  totalCount,
  hasNextPage,
  pageSizeOptions,
  onPageIndexChange,
  onPageSizeChange,
  pageSizeSelectId = "table-page-size",
}: {
  pageIndex: number;
  pageSize: number;
  totalCount?: number;
  hasNextPage?: boolean;
  pageSizeOptions?: readonly number[];
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeSelectId?: string;
}) {
  const pages = pageCount(totalCount, pageSize);
  const from = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const visibleEnd = pageIndex * pageSize + pageSize;
  const to = totalCount == null ? undefined : Math.min(totalCount, visibleEnd);
  const label =
    totalCount == null
      ? `Page ${pageIndex + 1}`
      : totalCount === 0
        ? "No rows"
        : `Showing ${from}–${to} of ${totalCount}`;
  const nextDisabled = pages == null ? hasNextPage !== true : pageIndex + 1 >= pages;
  const lastPageIndex = pages == null || pages === 0 ? 0 : pages - 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="type-caption text-text-secondary" aria-live="polite">
        {label}
      </p>
      <nav aria-label="Table pagination" className="flex flex-wrap items-center gap-2">
        {pageSizeOptions && onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <Label htmlFor={pageSizeSelectId} className="type-caption text-text-secondary">
              Rows
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger id={pageSizeSelectId} className="h-8 w-[4.5rem]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageIndex <= 0}
          onClick={() => onPageIndexChange(0)}
        >
          First
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageIndex <= 0}
          onClick={() => onPageIndexChange(pageIndex - 1)}
        >
          Previous
        </Button>
        <span className="type-caption text-text-secondary" aria-current="page">
          Page {pageIndex + 1}
          {pages != null && pages > 0 ? ` of ${pages}` : ""}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={nextDisabled}
          onClick={() => onPageIndexChange(pageIndex + 1)}
        >
          Next
        </Button>
        {pages != null && pages > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={nextDisabled}
            onClick={() => onPageIndexChange(lastPageIndex)}
          >
            Last
          </Button>
        ) : null}
      </nav>
    </div>
  );
}
