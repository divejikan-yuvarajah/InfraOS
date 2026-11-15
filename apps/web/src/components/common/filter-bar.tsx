"use client";

import { SearchIcon, XIcon } from "lucide-react";

export type FilterSelectOption = {
  value: string;
  label: string;
};

export type FilterSelectConfig = {
  key: string;
  label: string;
  value: string;
  options: readonly FilterSelectOption[];
  onChange: (value: string) => void;
};

type Props = {
  q?: string;
  onQChange?: (value: string) => void;
  searchPlaceholder?: string;
  selects?: readonly FilterSelectConfig[];
  onReset?: () => void;
  hasActiveFilters?: boolean;
};

export function FilterBar({
  q,
  onQChange,
  searchPlaceholder = "Search…",
  selects = [],
  onReset,
  hasActiveFilters,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
      {onQChange ? (
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q ?? ""}
            onChange={(e) => onQChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      ) : null}

      {selects.map((sel) => (
        <select
          key={sel.key}
          value={sel.value}
          onChange={(e) => sel.onChange(e.target.value)}
          aria-label={sel.label}
          className="h-10 min-w-[140px] rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
        >
          {sel.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}

      {onReset && hasActiveFilters ? (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <XIcon className="h-3.5 w-3.5" />
          Reset
        </button>
      ) : null}
    </div>
  );
}
