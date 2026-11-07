"use client";

import { AlertTriangleIcon, BanIcon, CalendarClockIcon, CheckCircle2Icon, ChevronsUpIcon, ChevronUpIcon, InfoIcon, MinusIcon, PlayCircleIcon, WrenchIcon, XCircleIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Chip, EmptyState, Field, Skeletons } from "@/components/inspections/inspection-ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { failureOf } from "@/lib/assets/api";
import type { Copy } from "@/lib/assets/messages";
import type { AssetCondition, Basis, Flag, MaintenancePriority, MaintenanceStatus, OperationalStatus } from "@/lib/assets/types";
import { BAND_TONE, basisTone, CONDITION_FILL, CONDITION_TONE, donutSlices, fill, gaugeArc } from "@/lib/assets/view";

import "@/styles/contractors.css";
import "@/styles/inspections.css";
import "@/styles/assets.css";

export { EmptyState, Field, Skeletons, Chip };

/** Condition is always the ring plus the word; UNKNOWN is an empty ring, never a guessed level. */
export function ConditionChip({ value, copy }: { value: AssetCondition; copy: Copy }) {
  const tone = CONDITION_TONE[value];
  return (
    <span className="ast-cond">
      <span className="ast-ring" data-tone={tone} aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < CONDITION_FILL[value] ? "on" : ""} />)}</span>
      {copy.condition[value]}
    </span>
  );
}

export function BasisChip({ basis, copy, short }: { basis: Basis; copy: Copy; short?: boolean }) {
  const Icon = basis === "INSPECTION_VERIFIED" ? CheckCircle2Icon : basis === "MANUAL_ENTRY" ? InfoIcon : MinusIcon;
  return <Chip tone={basisTone(basis)} icon={<Icon aria-hidden="true" />} title={copy.basis[basis]}>{short ? copy.basisShort[basis] : copy.basis[basis]}</Chip>;
}

const OP_ICON: Record<OperationalStatus, typeof WrenchIcon> = { IN_SERVICE: CheckCircle2Icon, UNDER_MAINTENANCE: WrenchIcon, OUT_OF_SERVICE: AlertTriangleIcon, DECOMMISSIONED: BanIcon };
const OP_TONE: Record<OperationalStatus, "success" | "pending" | "critical" | "neutral"> = { IN_SERVICE: "success", UNDER_MAINTENANCE: "pending", OUT_OF_SERVICE: "critical", DECOMMISSIONED: "neutral" };
export function OpStatusChip({ status, copy }: { status: OperationalStatus; copy: Copy }) {
  const Icon = OP_ICON[status];
  return <Chip tone={OP_TONE[status]} icon={<Icon aria-hidden="true" />}>{copy.opStatus[status]}</Chip>;
}

const MS_VIEW: Record<MaintenanceStatus, { tone: "success" | "pending" | "critical" | "neutral" | "active"; Icon: typeof WrenchIcon }> = {
  REQUESTED: { tone: "pending", Icon: CalendarClockIcon }, PLANNED: { tone: "active", Icon: CalendarClockIcon }, SCHEDULED: { tone: "active", Icon: CalendarClockIcon }, IN_PROGRESS: { tone: "pending", Icon: PlayCircleIcon },
  COMPLETED: { tone: "success", Icon: CheckCircle2Icon }, CANCELLED: { tone: "neutral", Icon: BanIcon }, REJECTED: { tone: "critical", Icon: XCircleIcon },
};
export function MaintStatusChip({ status, overdue, copy }: { status: MaintenanceStatus; overdue?: boolean; copy: Copy }) {
  const { tone, Icon } = MS_VIEW[status];
  return (
    <span className="ins-status">
      <Chip tone={tone} icon={<Icon aria-hidden="true" />}>{copy.mstatus[status]}</Chip>
      {overdue ? <Chip tone="critical" icon={<AlertTriangleIcon aria-hidden="true" />}>{copy.mstatus.overdue}</Chip> : null}
    </span>
  );
}
export function PriorityChip({ priority, copy }: { priority: MaintenancePriority; copy: Copy }) {
  const Icon = priority === "URGENT" ? ChevronsUpIcon : priority === "HIGH" ? ChevronUpIcon : MinusIcon;
  return <span className="ins-prio" data-p={priority}><Icon aria-hidden="true" />{copy.mpriority[priority]}</span>;
}

export function HealthGauge({ score, band, copy }: { score: number; band: keyof typeof BAND_TONE | null; copy: Copy }) {
  const arc = gaugeArc(score);
  const tone = band ? BAND_TONE[band] : "pending";
  return (
    <div className="ast-gauge" data-tone={tone} role="img" aria-label={`${copy.healthPanel.score}: ${score}${band ? `, ${copy.band[band]}` : ""}`}>
      <svg viewBox="0 0 120 70" aria-hidden="true"><path className="track" d={arc.track} />{arc.value ? <path className="val" d={arc.value} /> : null}</svg>
      <span className="ast-gauge-num">{score}</span>
      {band ? <Chip tone={BAND_TONE[band]}>{copy.band[band]}</Chip> : null}
    </div>
  );
}

export function EvidencePips({ level, copy }: { level: "LOW" | "MODERATE" | "GOOD" | null; copy: Copy }) {
  const n = level === "GOOD" ? 3 : level === "MODERATE" ? 2 : level === "LOW" ? 1 : 0;
  return <span title={level ? copy.evidenceLevel[level] : ""}><span className="ast-pips" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i < n ? "on" : ""} />)}</span> {level ? copy.evidenceLevel[level] : "—"}</span>;
}

/** HealthChip for lists: a number only when the server returned one; legacy or missing values are an honest dash. */
export function HealthCell({ score, legacy, copy }: { score: number | null; legacy: boolean; copy: Copy }) {
  if (score !== null) return <strong>{score}</strong>;
  return <span className="ins-muted" title={legacy ? copy.dashboard.healthLegacy : copy.healthPanel.notEnoughTitle}>—</span>;
}

export const COND_COLOR: Record<AssetCondition, string> = { EXCELLENT: "#1f7a4c", GOOD: "#5aa36f", FAIR: "#e08a1e", POOR: "#b8482f", CRITICAL: "#7a1f2b", UNKNOWN: "#b4bfcc" };

export function ConditionDonut({ counts, copy }: { counts: Record<string, number>; copy: Copy }) {
  const order: AssetCondition[] = ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL", "UNKNOWN"];
  const parts = order.map((k) => ({ key: k, n: counts[k] ?? 0 }));
  const total = parts.reduce((s, p) => s + p.n, 0);
  const slices = donutSlices(parts);
  return (
    <div className="ast-donut">
      <svg viewBox="0 0 42 42" role="img" aria-label={`${copy.dashboard.charts.condition}: ${parts.filter((p) => p.n).map((p) => `${copy.condition[p.key as AssetCondition]} ${p.n}`).join(", ")}`}>
        <circle cx="21" cy="21" r="15.915" stroke="#eef2f7" />
        {slices.map((s) => <circle key={s.key} cx="21" cy="21" r="15.915" stroke={COND_COLOR[s.key as AssetCondition]} strokeDasharray={s.dash} strokeDashoffset={s.offset} />)}
        <text x="21" y="23" textAnchor="middle" fontSize="7" fontWeight="800" fill="currentColor">{total}</text>
      </svg>
      <ul className="ast-legend">{parts.filter((p) => p.n > 0).map((p) => <li key={p.key}><i style={{ background: COND_COLOR[p.key as AssetCondition] }} />{p.key === "UNKNOWN" ? copy.dashboard.charts.unassessed : copy.condition[p.key as AssetCondition]}: <strong>{p.n}</strong></li>)}</ul>
    </div>
  );
}

export function BarList({ rows, max, color = "var(--infra-orange)" }: { rows: { label: string; n: number; color?: string }[]; max?: number; color?: string }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.n));
  return <div className="ast-bars">{rows.map((r) => <div key={r.label} className="ast-bar-row"><span>{r.label}</span><span className="ast-bar-track" aria-hidden="true"><i style={{ width: `${(r.n / m) * 100}%`, background: r.color ?? color }} /></span><strong>{r.n}</strong></div>)}</div>;
}

export function FlagList({ flags, copy }: { flags: Flag[]; copy: Copy }) {
  const dict = copy.conditionPanel.flags as Record<string, string>;
  return <div style={{ display: "grid", gap: "0.4rem" }}>{flags.map((f, i) => <div key={`${f.code}${i}`} className="ast-flag" data-sev={f.severity}><AlertTriangleIcon aria-hidden="true" /><span>{fill(dict[f.code] ?? f.code, f.params)}</span></div>)}</div>;
}

export const ErrorState = ({ error, copy, onRetry }: { error: unknown; copy: Copy; onRetry?: () => void }) => {
  const f = failureOf(error);
  if (f.status === 403) return <EmptyState title={copy.common.forbiddenTitle} body={copy.common.forbiddenBody} />;
  if (f.status === 404) return <EmptyState title={copy.common.notFound} />;
  return <EmptyState title={copy.common.errorTitle} body={copy.common.errorBody} action={onRetry ? <button type="button" className="ctr-btn" onClick={onRetry}>{copy.common.retry}</button> : undefined} />;
};

/** User-facing text for a failed request: known reason first, then the status. Never echoes server internals. */
export function errorText(error: unknown, copy: Copy): string {
  const f = failureOf(error);
  const errs = copy.errors as Record<string, string>;
  if (f.reason && errs[f.reason]) return errs[f.reason]!;
  if (f.field === "acknowledgeWarnings") return copy.errors.acknowledgeWarnings;
  if (f.status === 401) return copy.errors.session;
  if (f.status === 403) return copy.errors.forbidden;
  if (f.status === 404) return copy.errors.notFound;
  if (f.status === 409) return copy.errors.conflict;
  if (f.status === 429) return copy.errors.rateLimited;
  if (f.status === 400 || f.status === 422) return copy.errors.validation;
  if (f.status === 0) return copy.errors.network;
  return copy.errors.generic;
}

export function Shell({ open, onOpenChange, title, description, wide, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; wide?: boolean; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} ctr-dialog max-h-[90vh] overflow-y-auto`}>
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : null}</DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
