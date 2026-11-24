"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ==========================================================================
 * 1. DataSourceBadge (§2.3 Data-honesty system)
 * ========================================================================== */

export type DataSourceKind = "live" | "recorded" | "demo" | "unavailable";

const DATA_SOURCE_META: Record<
  DataSourceKind,
  {
    glyph: string;
    label: string;
    tooltip: string;
    classes: string;
  }
> = {
  live: {
    glyph: "●",
    label: "Source: Live",
    tooltip: "Computed directly from live authenticated database records.",
    classes: "bg-[#f0fdf4] text-[#166b30] border-[#bbf7d0]",
  },
  recorded: {
    glyph: "◉",
    label: "Source: Recorded",
    tooltip: "Reflects the most recently submitted or logged record snapshot.",
    classes: "bg-[#f8fafc] text-[#334155] border-[#cbd5e1]",
  },
  demo: {
    glyph: "◇",
    label: "Synthetic demo",
    tooltip: "Illustrative demonstration dataset; not live operational telemetry.",
    classes: "bg-[#fffbeb] text-[#6c5311] border-[#fde68a]",
  },
  unavailable: {
    glyph: "–",
    label: "Unavailable",
    tooltip: "Telemetry source is currently unreachable, restricted, or not configured.",
    classes: "bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]",
  },
};

export function DataSourceBadge({
  kind,
  label,
  asOf,
  tooltip,
  className,
}: {
  kind: DataSourceKind;
  label?: string;
  asOf?: string | null;
  tooltip?: string;
  className?: string;
}) {
  const meta = DATA_SOURCE_META[kind];
  const displayLabel = label ?? meta.label;
  const fullHint = tooltip ?? meta.tooltip;

  return (
    <span
      role="status"
      title={fullHint}
      aria-label={`${displayLabel}${asOf ? ` (${asOf})` : ""}. ${fullHint}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight tabular-nums select-none",
        meta.classes,
        className,
      )}
    >
      <span aria-hidden="true" className="font-mono text-[10px] leading-none">
        {meta.glyph}
      </span>
      <span>{displayLabel}</span>
      {asOf ? (
        <span className="border-l border-current/25 pl-1.5 font-mono text-[10px] opacity-85">
          {asOf}
        </span>
      ) : null}
    </span>
  );
}

/* ==========================================================================
 * 2. BenchmarkStatusBadge (§2.2.4 Benchmark status marker)
 * ========================================================================== */

export type BenchmarkTone =
  | "active"
  | "planned"
  | "pending"
  | "delayed"
  | "blocked"
  | "completed"
  | "verified"
  | "attention"
  | "unavailable";

const BENCHMARK_TONE_META: Record<
  BenchmarkTone,
  { glyph: string; classes: string }
> = {
  active: {
    glyph: "●",
    classes: "bg-[#fff7ed] text-[#9a3412] border-[#fed7aa]",
  },
  planned: {
    glyph: "○",
    classes: "bg-[#f8fafc] text-[#334155] border-[#cbd5e1]",
  },
  pending: {
    glyph: "◐",
    classes: "bg-[#fffbeb] text-[#6c5311] border-[#fde68a]",
  },
  delayed: {
    glyph: "▲",
    classes: "bg-[#fffbeb] text-[#854d0e] border-[#fcd34d]",
  },
  blocked: {
    glyph: "■",
    classes: "bg-[#fef2f2] text-[#8c1f28] border-[#fecaca]",
  },
  completed: {
    glyph: "✓",
    classes: "bg-[#f0fdf4] text-[#166b30] border-[#bbf7d0]",
  },
  verified: {
    glyph: "◎",
    classes: "bg-[#f0fdf4] text-[#14532d] border-[#86efac]",
  },
  attention: {
    glyph: "!",
    classes: "bg-[#fef2f2] text-[#8c1f28] border-[#fca5a5]",
  },
  unavailable: {
    glyph: "–",
    classes: "bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]",
  },
};

export function inferBenchmarkTone(status: string): BenchmarkTone {
  const s = status.toUpperCase().trim();
  if (s === "VERIFIED" || s === "CERTIFIED") return "verified";
  if (s === "COMPLETED" || s === "CLOSED" || s === "APPROVED" || s === "RESOLVED" || s === "SUCCESS")
    return "completed";
  if (s === "ACTIVE" || s === "IN_PROGRESS" || s === "OPEN") return "active";
  if (s === "DELAYED" || s === "OVERDUE" || s === "WARNING") return "delayed";
  if (
    s === "BLOCKED" ||
    s === "REJECTED" ||
    s === "CRITICAL" ||
    s === "DENIED" ||
    s === "FAILED" ||
    s === "DISABLED"
  )
    return "blocked";
  if (s === "ON_HOLD" || s === "UNDER_REVIEW" || s === "SUBMITTED" || s === "PENDING")
    return "pending";
  if (s === "UNAVAILABLE" || s === "CANCELLED") return "unavailable";
  return "planned";
}

export function BenchmarkStatusBadge({
  status,
  label,
  tone,
  size = "md",
  className,
}: {
  status: string;
  label?: string;
  tone?: BenchmarkTone;
  size?: "sm" | "md";
  className?: string;
}) {
  const resolvedTone = tone ?? inferBenchmarkTone(status);
  const meta = BENCHMARK_TONE_META[resolvedTone];
  const display =
    label ??
    status
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap tabular-nums",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        meta.classes,
        className,
      )}
    >
      <span aria-hidden="true" className="font-mono text-[10px] leading-none">
        {meta.glyph}
      </span>
      <span>{display}</span>
    </span>
  );
}

/* ==========================================================================
 * 3. ChainageBar (§2.2.1 Chainage ruler progress bar)
 * ========================================================================== */

function clampPct(val: number | null | undefined): number | null {
  if (typeof val !== "number" || Number.isNaN(val)) return null;
  return Math.max(0, Math.min(100, Math.round(val)));
}

export function ChainageBar({
  verifiedPercent,
  reportedPercent,
  label = "Progress",
  verifiedLabel = "Verified",
  reportedLabel = "Reported",
  showRulerLabels = true,
  tone = "default",
  className,
}: {
  verifiedPercent?: number | null;
  reportedPercent?: number | null;
  label?: string;
  verifiedLabel?: string;
  reportedLabel?: string;
  showRulerLabels?: boolean;
  tone?: "default" | "budget";
  className?: string;
}) {
  const verified = clampPct(verifiedPercent);
  const reported = clampPct(reportedPercent);
  const hasBoth = verified !== null && reported !== null;

  const ariaSummary = hasBoth
    ? `${label}: ${verifiedLabel} ${verified}%, ${reportedLabel} ${reported}%`
    : verified !== null
      ? `${label}: ${verifiedLabel} ${verified}%`
      : reported !== null
        ? `${label}: ${reportedLabel} ${reported}% (unverified)`
        : `${label}: Not recorded`;

  const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <div
      role="img"
      aria-label={ariaSummary}
      className={cn("w-full select-none", className)}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-800">{label}</span>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums">
          {verified !== null ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#166b30]">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full bg-[#279541]"
              />
              {verifiedLabel}: {verified}%
            </span>
          ) : null}
          {reported !== null ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#9a3412]">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#ff5b00] bg-white"
              />
              {reportedLabel}: {reported}%
            </span>
          ) : null}
          {verified === null && reported === null ? (
            <span className="text-slate-500">Not recorded</span>
          ) : null}
        </div>
      </div>

      {/* Chainage Ruler Track */}
      <div className="relative h-5 w-full rounded-md border border-slate-300 bg-slate-100/90 px-0.5 overflow-hidden">
        {/* Filled segment (Verified if present, else light amber tint for Reported-only) */}
        {verified !== null ? (
          <div
            aria-hidden="true"
            style={{ width: `${verified}%` }}
            className={cn(
              "absolute inset-y-0 left-0 transition-[width] duration-200 ease-out",
              tone === "budget" && verified > 90
                ? "bg-[#8c1f28]/85"
                : "bg-[#279541]/85",
            )}
          />
        ) : reported !== null ? (
          <div
            aria-hidden="true"
            style={{ width: `${reported}%` }}
            className="absolute inset-y-0 left-0 bg-[#ff5b00]/25 transition-[width] duration-200 ease-out"
          />
        ) : null}

        {/* 10% Chainage Tick Marks */}
        <div
          aria-hidden="true"
          className="relative z-10 flex h-full w-full items-end justify-between px-1"
        >
          {ticks.map((t) => (
            <div key={t} className="flex flex-col items-center">
              <span
                className={cn(
                  "w-px bg-slate-500/50",
                  t % 50 === 0 ? "h-3 bg-slate-700/70" : "h-1.5",
                )}
              />
            </div>
          ))}
        </div>

        {/* Hollow station marker for Reported progress */}
        {reported !== null ? (
          <div
            aria-hidden="true"
            style={{ left: `calc(${reported}% - 6px)` }}
            title={`${reportedLabel}: ${reported}%`}
            className="absolute top-1/2 z-20 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-[#ff5b00] bg-white shadow-xs transition-[left] duration-200 ease-out"
          />
        ) : null}
      </div>

      {/* Chainage Station Labels (0+00 .. 1+00) */}
      {showRulerLabels ? (
        <div
          aria-hidden="true"
          className="mt-1 flex justify-between font-mono text-[10px] text-slate-500 tabular-nums"
        >
          <span>0+00</span>
          <span>0+25</span>
          <span>0+50</span>
          <span>0+75</span>
          <span>1+00</span>
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
 * 4. AlignmentTimeline (§2.2.2 Alignment timeline with station markers)
 * ========================================================================== */

export type AlignmentStationState =
  | "planned"
  | "recorded"
  | "verified"
  | "delayed"
  | "blocked"
  | "completed";

export type AlignmentTimelineItem = {
  id: string;
  stationCode: string;
  title: string;
  subtitle?: string;
  state: AlignmentStationState;
  statusLabel?: string;
  plannedWindow?: string;
  actualWindow?: string;
  actor?: string;
  progressPercent?: number | null;
  verifiedPercent?: number | null;
  badge?: ReactNode;
  actions?: ReactNode;
  details?: ReactNode;
};

function StationNode({ state }: { state: AlignmentStationState }) {
  if (state === "verified" || state === "completed") {
    return (
      <span
        aria-hidden="true"
        className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#279541] bg-[#f0fdf4] text-[#166b30] font-mono text-xs font-bold shadow-2xs"
      >
        {state === "verified" ? "◎" : "✓"}
      </span>
    );
  }
  if (state === "delayed") {
    return (
      <span
        aria-hidden="true"
        className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-[#d97706] bg-[#fffbeb] text-[#854d0e] font-mono text-[11px] font-bold"
      >
        ▲
      </span>
    );
  }
  if (state === "blocked") {
    return (
      <span
        aria-hidden="true"
        className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#8c1f28] bg-[#fef2f2] text-[#8c1f28] font-mono text-[10px] font-bold"
      >
        ■
      </span>
    );
  }
  if (state === "recorded") {
    return (
      <span
        aria-hidden="true"
        className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#ff5b00] bg-[#fff7ed] text-[#c43d00] font-mono text-xs font-bold"
      >
        ●
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-slate-500 font-mono text-xs"
    >
      ○
    </span>
  );
}

export function AlignmentTimeline({
  items,
  orientation = "vertical",
  ariaLabel = "Alignment station timeline",
  className,
}: {
  items: readonly AlignmentTimelineItem[];
  orientation?: "vertical" | "horizontal";
  ariaLabel?: string;
  className?: string;
}) {
  if (orientation === "horizontal") {
    return (
      <ol
        aria-label={ariaLabel}
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4",
          className,
        )}
      >
        {items.map((item) => (
          <li
            key={item.id}
            className="cac-card relative flex flex-col justify-between p-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <StationNode state={item.state} />
                  <span className="font-mono text-xs font-bold text-slate-600 tabular-nums">
                    {item.stationCode}
                  </span>
                </div>
                {item.statusLabel ? (
                  <BenchmarkStatusBadge
                    status={item.state}
                    label={item.statusLabel}
                    size="sm"
                  />
                ) : null}
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                {item.title}
              </h3>
              {item.subtitle ? (
                <p className="mt-1 text-xs text-slate-600">{item.subtitle}</p>
              ) : null}
            </div>
            {(item.plannedWindow || item.actualWindow) && (
              <div className="mt-3 border-t border-slate-100 pt-2 font-mono text-[11px] text-slate-500 space-y-0.5">
                {item.plannedWindow ? <div>Plan: {item.plannedWindow}</div> : null}
                {item.actualWindow ? <div>Actual: {item.actualWindow}</div> : null}
              </div>
            )}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol
      aria-label={ariaLabel}
      className={cn(
        "relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-3 before:w-0.5 before:bg-slate-200",
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.id} className="relative pl-10">
          <div className="absolute top-3.5 left-0 z-10">
            <StationNode state={item.state} />
          </div>
          <article className="cac-card p-4 transition-shadow hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-700 tabular-nums">
                    {item.stationCode}
                  </span>
                  {item.statusLabel ? (
                    <BenchmarkStatusBadge
                      status={item.state}
                      label={item.statusLabel}
                      size="sm"
                    />
                  ) : null}
                  {item.badge}
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  {item.title}
                </h3>
                {item.subtitle ? (
                  <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
                ) : null}
              </div>
              {item.actions ? (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {item.actions}
                </div>
              ) : null}
            </div>

            {(item.plannedWindow || item.actualWindow || item.actor) && (
              <dl className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600 sm:grid-cols-3">
                {item.plannedWindow ? (
                  <div>
                    <dt className="font-medium text-slate-500">Planned schedule</dt>
                    <dd className="font-mono font-semibold text-slate-800 tabular-nums">
                      {item.plannedWindow}
                    </dd>
                  </div>
                ) : null}
                {item.actualWindow ? (
                  <div>
                    <dt className="font-medium text-slate-500">Recorded / actual</dt>
                    <dd className="font-mono font-semibold text-slate-800 tabular-nums">
                      {item.actualWindow}
                    </dd>
                  </div>
                ) : null}
                {item.actor ? (
                  <div>
                    <dt className="font-medium text-slate-500">Responsible</dt>
                    <dd className="font-semibold text-slate-800">{item.actor}</dd>
                  </div>
                ) : null}
              </dl>
            )}

            {typeof item.progressPercent === "number" ||
            typeof item.verifiedPercent === "number" ? (
              <div className="mt-3 pt-2 border-t border-slate-100">
                <ChainageBar
                  verifiedPercent={item.verifiedPercent}
                  reportedPercent={item.progressPercent}
                  showRulerLabels={false}
                />
              </div>
            ) : null}

            {item.details ? <div className="mt-3">{item.details}</div> : null}
          </article>
        </li>
      ))}
    </ol>
  );
}

/* ==========================================================================
 * 5. CommandHeader (§2.2.3 Survey-grid header & §2.4 PageHeader)
 * ========================================================================== */

export function CommandHeader({
  eyebrow,
  title,
  subtitle,
  scopeLabel,
  asOf,
  sourceKind = "live",
  sourceLabel,
  primaryAction,
  secondaryActions,
  variant = "navy",
  className,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  scopeLabel?: string;
  asOf?: string | null;
  sourceKind?: DataSourceKind;
  sourceLabel?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  variant?: "navy" | "light";
  className?: string;
  children?: ReactNode;
}) {
  const isNavy = variant === "navy";

  return (
    <section
      className={cn(
        "rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 mb-3.5",
        isNavy
          ? "cac-survey-header shadow-sm"
          : "cac-card border-l-4 border-l-[#ff5b00]",
        className,
      )}
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {eyebrow ? (
              <span
                className={cn(
                  "font-mono text-[10px] font-bold uppercase tracking-wider",
                  isNavy ? "text-[#ffb597]" : "text-[#c43d00]",
                )}
              >
                {eyebrow}
              </span>
            ) : null}
            {scopeLabel ? (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium",
                  isNavy
                    ? "bg-white/10 text-slate-200 border border-white/15"
                    : "bg-slate-100 text-slate-700 border border-slate-200",
                )}
              >
                {scopeLabel}
              </span>
            ) : null}
            <DataSourceBadge
              kind={sourceKind}
              label={sourceLabel}
              asOf={asOf}
            />
          </div>

          <h1
            className={cn(
              "text-lg sm:text-xl font-bold tracking-tight leading-tight",
              isNavy ? "text-white" : "text-slate-900",
            )}
          >
            {title}
          </h1>

          {subtitle ? (
            <div
              className={cn(
                "max-w-3xl text-xs leading-snug line-clamp-2",
                isNavy ? "text-slate-300" : "text-slate-600",
              )}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {(primaryAction || secondaryActions) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {secondaryActions}
            {primaryAction}
          </div>
        )}
      </div>

      {children ? (
        <div
          className={cn(
            "mt-2 pt-2 border-t",
            isNavy ? "border-white/10" : "border-slate-200",
          )}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

/* ==========================================================================
 * 6. MetricCard (§2.4 MetricCard with tabular numerals & data honesty)
 * ========================================================================== */

export function MetricCard({
  label,
  value,
  context,
  sourceKind,
  tone = "neutral",
  action,
  loading = false,
  className,
}: {
  label: string;
  value: ReactNode;
  context?: ReactNode;
  sourceKind?: DataSourceKind;
  tone?: "neutral" | "success" | "warning" | "critical" | "brand";
  action?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const accentBorder =
    tone === "critical"
      ? "border-t-2 border-t-[#8c1f28]"
      : tone === "warning"
        ? "border-t-2 border-t-[#feb600]"
        : tone === "success"
          ? "border-t-2 border-t-[#279541]"
          : tone === "brand"
            ? "border-t-2 border-t-[#ff5b00]"
            : "";

  if (loading) {
    return (
      <div
        role="status"
        aria-label={`Loading ${label}`}
        className={cn("cac-card p-4 space-y-2", className)}
      >
        <div className="h-3.5 w-24 rounded bg-slate-200 motion-safe:animate-pulse" />
        <div className="h-7 w-20 rounded bg-slate-200 motion-safe:animate-pulse" />
        <div className="h-3 w-32 rounded bg-slate-100 motion-safe:animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "cac-card flex flex-col justify-between p-4 cac-stagger-enter",
        accentBorder,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        {sourceKind ? <DataSourceBadge kind={sourceKind} /> : null}
      </div>
      <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
        {value}
      </div>
      {(context || action) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-600">
          {context ? <span className="truncate">{context}</span> : <span />}
          {action}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
 * 7. ChartFrame (§2.4 ChartFrame with "View as table" fallback)
 * ========================================================================== */

export function ChartFrame({
  title,
  subtitle,
  sourceKind = "live",
  legend,
  tableHeaders,
  tableRows,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  sourceKind?: DataSourceKind;
  legend?: ReactNode;
  tableHeaders?: readonly string[];
  tableRows?: ReadonlyArray<readonly ReactNode[]>;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const hasTable =
    Boolean(tableHeaders && tableHeaders.length > 0) &&
    Boolean(tableRows && tableRows.length > 0);

  return (
    <section className={cn("cac-card p-5", className)} aria-label={title}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <DataSourceBadge kind={sourceKind} />
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {legend}
          {hasTable ? (
            <button
              type="button"
              onClick={() => setShowTable((prev) => !prev)}
              aria-pressed={showTable}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b00]"
            >
              {showTable ? "View chart" : "View as table"}
            </button>
          ) : null}
          {actions}
        </div>
      </div>

      {showTable && hasTable ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                {tableHeaders!.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows!.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/70">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 tabular-nums text-slate-800">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>{children}</div>
      )}
    </section>
  );
}

/* ==========================================================================
 * 8. Unified Dashboard Primitives (Civic Atlas Command 2.0)
 *    Shared canvas, KPI strip, interactive KPI cards, and section panels so
 *    every role dashboard and module dashboard shares one cohesive UI system.
 * ========================================================================== */

export function DashboardCanvas({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-[1600px] mx-auto w-full px-4 sm:px-gutter-desktop py-4 pb-10 space-y-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DashboardKpiGrid({
  children,
  columns = 4,
  label = "Key metrics",
  className,
}: {
  children: ReactNode;
  columns?: 4 | 5 | 6 | 8;
  label?: string;
  className?: string;
}) {
  const colClass =
    columns === 8
      ? "grid-cols-2 sm:grid-cols-4 xl:grid-cols-8"
      : columns === 6
        ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
        : columns === 5
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4";

  return (
    <section
      aria-label={label}
      aria-live="polite"
      className={cn("grid gap-3.5", colClass, className)}
    >
      {children}
    </section>
  );
}

export type DashboardKpiTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "critical";

export function DashboardKpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  badge,
  progressPercent,
  active = false,
  loading = false,
  onClick,
  href,
  ariaLabel,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: DashboardKpiTone;
  badge?: ReactNode;
  progressPercent?: number | null;
  active?: boolean;
  loading?: boolean;
  onClick?: () => void;
  href?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const accentBorder =
    tone === "critical"
      ? "border-t-[3px] border-t-[#8c1f28]"
      : tone === "warning"
        ? "border-t-[3px] border-t-[#feb600]"
        : tone === "success"
          ? "border-t-[3px] border-t-[#279541]"
          : tone === "brand"
            ? "border-t-[3px] border-t-[#ff5b00]"
            : "border-t-[3px] border-t-[#14202d]";

  const barColor =
    tone === "critical"
      ? "bg-[#8c1f28]"
      : tone === "warning"
        ? "bg-[#feb600]"
        : tone === "success"
          ? "bg-[#279541]"
          : "bg-[#ff5b00]";

  if (loading) {
    return (
      <div
        role="status"
        aria-label={`Loading ${label}`}
        className={cn("cac-card p-4 space-y-2.5", accentBorder, className)}
      >
        <div className="h-3.5 w-24 rounded bg-slate-200 motion-safe:animate-pulse" />
        <div className="h-7 w-20 rounded bg-slate-200 motion-safe:animate-pulse" />
        <div className="h-3 w-32 rounded bg-slate-100 motion-safe:animate-pulse" />
      </div>
    );
  }

  const interactive = Boolean(onClick || href);
  const sharedClasses = cn(
    "cac-card flex flex-col justify-between p-4 text-left transition-all cac-stagger-enter min-h-[104px]",
    accentBorder,
    interactive
      ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff5b00]"
      : "",
    active ? "ring-2 ring-[#ff5b00] bg-[#fffaf7]" : "",
    className,
  );

  const clampedProgress =
    typeof progressPercent === "number" && !Number.isNaN(progressPercent)
      ? Math.max(0, Math.min(100, progressPercent))
      : null;

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 leading-snug">
          {label}
        </span>
        {badge ? <span className="shrink-0">{badge}</span> : null}
      </div>
      <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
        {value}
      </div>
      {clampedProgress !== null ? (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
          aria-hidden="true"
        >
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      ) : null}
      {hint ? (
        <div className="mt-2 text-xs text-slate-600 leading-snug line-clamp-2">
          {hint}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        className={cn(sharedClasses, "no-underline")}
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={ariaLabel}
        className={sharedClasses}
      >
        {content}
      </button>
    );
  }

  return (
    <div aria-label={ariaLabel} className={sharedClasses}>
      {content}
    </div>
  );
}

export function DashboardSection({
  title,
  eyebrow,
  subtitle,
  sourceKind,
  actions,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: ReactNode;
  sourceKind?: DataSourceKind;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("cac-card p-5", className)} aria-label={title}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#a83900] mb-0.5">
              {eyebrow}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            {sourceKind ? <DataSourceBadge kind={sourceKind} /> : null}
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
