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
    <div className="cac-inset flex flex-wrap items-center gap-2.5 p-3">
      {onQChange ? (
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q ?? ""}
            onChange={(e) => onQChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#ff5b00] focus:outline-2 focus:outline-offset-2 focus:outline-[#ff5b00]"
          />
        </div>
      ) : null}

      {selects.map((sel) => (
        <select
          key={sel.key}
          value={sel.value}
          onChange={(e) => sel.onChange(e.target.value)}
          aria-label={sel.label}
          className="h-10 min-w-[140px] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#ff5b00] focus:outline-2 focus:outline-offset-2 focus:outline-[#ff5b00]"
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
          className="inline-flex h-10 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b00]"
        >
          <XIcon className="h-3.5 w-3.5" />
          Reset
        </button>
      ) : null}
    </div>
  );
}
