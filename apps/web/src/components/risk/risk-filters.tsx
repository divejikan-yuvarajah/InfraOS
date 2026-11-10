"use client";

import { SearchIcon, XIcon, FilterIcon } from "lucide-react";
import type { RiskListFilters } from "@/lib/risk/types";
import { CATEGORY_LABELS, LEVEL_CONFIG } from "@/lib/risk/view";

const PROJECT_TYPES = [
  "ROAD",
  "BRIDGE",
  "DRAINAGE",
  "BUILDING",
  "WATER",
  "ELECTRICITY",
];

const STATUSES = [
  "ACTIVE",
  "DELAYED",
  "ON_HOLD",
  "APPROVED",
];

export function RiskFilters({
  filters,
  onChange,
  onReset,
  className = "",
}: {
  filters: RiskListFilters;
  onChange: (updated: Partial<RiskListFilters>) => void;
  onReset: () => void;
  className?: string;
}) {
  const hasActiveFilters = Boolean(
    filters.q ||
      filters.agencyId ||
      filters.projectType ||
      filters.status ||
      filters.level ||
      filters.category ||
      filters.sufficiency ||
      filters.resolution ||
      filters.stale ||
      filters.district,
  );

  return (
    <div
      role="search"
      aria-label="Filter risk projects"
      className={`rounded-lg border border-border bg-surface p-4 shadow-2xs space-y-3 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <SearchIcon className="absolute left-3 top-2.5 size-4 text-text-muted" aria-hidden="true" />
          <input
            type="search"
            value={filters.q ?? ""}
            onChange={(e) => onChange({ q: e.target.value, page: 1 })}
            placeholder="Search by project code, title, or contractor…"
            className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Level Filter */}
        <select
          value={filters.level ?? ""}
          onChange={(e) => onChange({ level: e.target.value || undefined, page: 1 })}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filter by Risk Level"
        >
          <option value="">All Risk Levels</option>
          <option value="CRITICAL">Critical (◆)</option>
          <option value="HIGH">High (▲)</option>
          <option value="MODERATE">Moderate (◐)</option>
          <option value="LOW">Low (○)</option>
          <option value="NOT_ASSESSABLE">Not Assessable (?)</option>
        </select>

        {/* Category Flag Filter */}
        <select
          value={filters.category ?? ""}
          onChange={(e) => onChange({ category: e.target.value || undefined, page: 1 })}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filter by Category"
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label} (≥ High)
            </option>
          ))}
        </select>

        {/* Project Status */}
        <select
          value={filters.status ?? ""}
          onChange={(e) => onChange({ status: e.target.value || undefined, page: 1 })}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filter by Status"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        {/* Project Type */}
        <select
          value={filters.projectType ?? ""}
          onChange={(e) => onChange({ projectType: e.target.value || undefined, page: 1 })}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filter by Project Type"
        >
          <option value="">All Types</option>
          {PROJECT_TYPES.map((pt) => (
            <option key={pt} value={pt}>
              {pt}
            </option>
          ))}
        </select>

        {/* Resolution State */}
        <select
          value={filters.resolution ?? ""}
          onChange={(e) => onChange({ resolution: e.target.value || undefined, page: 1 })}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filter by Resolution"
        >
          <option value="">All Triage States</option>
          <option value="unacknowledged">Unacknowledged Only</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="reopened">Reopened</option>
        </select>

        {/* Stale Toggle */}
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(filters.stale)}
            onChange={(e) => onChange({ stale: e.target.checked || undefined, page: 1 })}
            className="rounded border-border text-infra-orange focus:ring-ring"
          />
          <span>Stale only (&gt;7d)</span>
        </label>

        {/* Reset Button */}
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-container-low hover:text-text-primary"
            aria-label="Reset all filters"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        ) : null}
      </div>

      {/* Applied filter pills */}
      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/30 text-[11px]">
          <span className="text-text-muted flex items-center gap-1">
            <FilterIcon className="size-3" aria-hidden="true" /> Active Filters:
          </span>
          {filters.q ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-container-low px-2 py-0.5 text-text-secondary">
              Search: &ldquo;{filters.q}&rdquo;
              <button type="button" onClick={() => onChange({ q: undefined })} className="hover:text-text-primary">
                ×
              </button>
            </span>
          ) : null}
          {filters.level ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-container-low px-2 py-0.5 text-text-secondary">
              Level: {filters.level}
              <button type="button" onClick={() => onChange({ level: undefined })} className="hover:text-text-primary">
                ×
              </button>
            </span>
          ) : null}
          {filters.category ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-container-low px-2 py-0.5 text-text-secondary">
              Category: {filters.category}
              <button type="button" onClick={() => onChange({ category: undefined })} className="hover:text-text-primary">
                ×
              </button>
            </span>
          ) : null}
          {filters.status ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-container-low px-2 py-0.5 text-text-secondary">
              Status: {filters.status}
              <button type="button" onClick={() => onChange({ status: undefined })} className="hover:text-text-primary">
                ×
              </button>
            </span>
          ) : null}
          {filters.resolution ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-container-low px-2 py-0.5 text-text-secondary">
              Triage: {filters.resolution}
              <button type="button" onClick={() => onChange({ resolution: undefined })} className="hover:text-text-primary">
                ×
              </button>
            </span>
          ) : null}
          {filters.stale ? (
            <span className="inline-flex items-center gap-1 rounded bg-surface-container-low px-2 py-0.5 text-text-secondary">
              Stale Assessments
              <button type="button" onClick={() => onChange({ stale: undefined })} className="hover:text-text-primary">
                ×
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
