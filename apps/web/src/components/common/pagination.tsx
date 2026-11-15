"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, total, onPageChange }: Props) {
  const safeTotalPages = Math.max(1, totalPages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600">
      <span className="tabular-nums">
        Page {page} of {safeTotalPages} ({total} total)
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-9 min-w-[44px] items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Prev
        </button>
        <button
          type="button"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-9 min-w-[44px] items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
