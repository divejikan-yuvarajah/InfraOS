"use client";

import { AlertTriangleIcon, BanIcon, CalendarClockIcon, CheckCircle2Icon, ChevronsUpIcon, ChevronUpIcon, MinusIcon, PlayCircleIcon, RotateCcwIcon, SendIcon, ImageOffIcon, XCircleIcon } from "lucide-react";
import { useId, useState } from "react";

import { useAuthedImage } from "@/lib/inspections/use-authed-image";
import { failureOf } from "@/lib/inspections/api";
import type { Copy } from "@/lib/inspections/messages";
import type { InspectionPriority, InspectionStatus } from "@/lib/inspections/types";
import { fill } from "@/lib/inspections/view";

import "@/styles/contractors.css";
import "@/styles/inspections.css";

type Tone = "success" | "pending" | "critical" | "neutral" | "active";
export const Chip = ({ tone = "neutral", icon, children, title }: { tone?: Tone; icon?: React.ReactNode; children: React.ReactNode; title?: string }) => <span className="ctr-badge" data-tone={tone} title={title}>{icon}{children}</span>;

const STATUS_VIEW: Record<InspectionStatus, { tone: Tone; Icon: typeof CheckCircle2Icon }> = {
  SCHEDULED: { tone: "active", Icon: CalendarClockIcon }, IN_PROGRESS: { tone: "pending", Icon: PlayCircleIcon }, SUBMITTED: { tone: "active", Icon: SendIcon },
  VERIFIED: { tone: "success", Icon: CheckCircle2Icon }, REQUIRES_REVIEW: { tone: "pending", Icon: RotateCcwIcon }, REJECTED: { tone: "critical", Icon: XCircleIcon }, CANCELLED: { tone: "neutral", Icon: BanIcon },
};

/** Status is always an icon plus a label, never colour alone. Overdue is derived by the server and shown as a second badge. */
export function StatusBadge({ status, overdue, copy }: { status: InspectionStatus; overdue?: boolean; copy: Copy }) {
  const { tone, Icon } = STATUS_VIEW[status];
  return (
    <span className="ins-status">
      <Chip tone={tone} icon={<Icon aria-hidden="true" />}>{copy.status[status]}</Chip>
      {overdue ? <Chip tone="critical" icon={<AlertTriangleIcon aria-hidden="true" />}>{copy.status.overdue}</Chip> : null}
    </span>
  );
}

export function PriorityChip({ priority, copy }: { priority: InspectionPriority; copy: Copy }) {
  const Icon = priority === "URGENT" ? ChevronsUpIcon : priority === "HIGH" ? ChevronUpIcon : MinusIcon;
  return <span className="ins-prio" data-p={priority}><Icon aria-hidden="true" />{copy.priority[priority]}</span>;
}

export const STATUS_ICONS: Record<InspectionStatus, typeof CheckCircle2Icon> = { SCHEDULED: CalendarClockIcon, IN_PROGRESS: PlayCircleIcon, SUBMITTED: SendIcon, VERIFIED: CheckCircle2Icon, REQUIRES_REVIEW: RotateCcwIcon, REJECTED: XCircleIcon, CANCELLED: BanIcon };

/** Scheduled -> Started -> Submitted -> Decision, with the branches (revision, reject, cancel) shown as the final node. */
export function InspectionStepper({ status, copy }: { status: InspectionStatus; copy: Copy }) {
  const order = ["SCHEDULED", "IN_PROGRESS", "SUBMITTED"] as const;
  const idx = status === "CANCELLED" ? 0 : status === "SCHEDULED" ? 0 : status === "IN_PROGRESS" ? 1 : status === "SUBMITTED" ? 2 : 3;
  const last = status === "VERIFIED" ? { label: copy.stepper.verified, state: "done" } : status === "REJECTED" ? { label: copy.stepper.rejected, state: "bad" } : status === "REQUIRES_REVIEW" ? { label: copy.stepper.revision, state: "current" } : status === "CANCELLED" ? { label: copy.stepper.cancelled, state: "bad" } : { label: copy.stepper.decision, state: "todo" };
  const labels = [copy.stepper.scheduled, copy.stepper.started, copy.stepper.submitted];
  return (
    <ol className="ins-stepper" aria-label={copy.status[status]}>
      {order.map((_, i) => <li key={i} className="ins-step" data-state={status === "CANCELLED" ? (i === 0 ? "done" : "todo") : i < idx ? "done" : i === idx && idx < 3 ? "current" : i < 3 && idx >= 3 ? "done" : "todo"}><i aria-hidden="true" />{labels[i]}</li>)}
      <li className="ins-step" data-state={last.state}><i aria-hidden="true" />{last.label}</li>
    </ol>
  );
}

export function Field({ label, error, hint, children, wide }: { label: string; error?: string | null; hint?: string; children: (id: string) => React.ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={`ctr-field${wide ? " is-wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint ? <p className="ctr-small">{hint}</p> : null}
      {error ? <p className="ctr-error" role="alert">{error}</p> : null}
    </div>
  );
}

export function Skeletons({ n = 3 }: { n?: number }) {
  return <div className="ins" role="status" aria-busy="true">{Array.from({ length: n }, (_, i) => <div key={i} className="ins-skel" />)}</div>;
}
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return <div className="ins-empty"><strong>{title}</strong>{body ? <p className="ins-muted">{body}</p> : null}{action}</div>;
}
export function ErrorState({ error, copy, onRetry }: { error: unknown; copy: Copy; onRetry?: () => void }) {
  const f = failureOf(error);
  if (f.status === 403) return <EmptyState title={copy.common.forbiddenTitle} body={copy.common.forbiddenBody} />;
  if (f.status === 404) return <EmptyState title={copy.common.notFound} />;
  return <EmptyState title={copy.common.errorTitle} body={copy.common.errorBody} action={onRetry ? <button type="button" className="ctr-btn" onClick={onRetry}>{copy.common.retry}</button> : undefined} />;
}

/** User-facing text for a failed request: a known reason first, then the status. */
export function errorText(error: unknown, copy: Copy): string {
  const f = failureOf(error);
  const errs = copy.errors as Record<string, string>;
  if (f.reason && errs[f.reason]) return errs[f.reason]!;
  if (f.field === "acknowledgeDiscrepancy") return copy.errors.acknowledgeDiscrepancy;
  if (f.field === "inspectorId") return copy.errors.inspectorScope;
  if (f.field === "inspectionDate") return copy.schedule.dateInPast;
  if (f.status === 401) return copy.errors.session;
  if (f.status === 403) return copy.errors.forbidden;
  if (f.status === 404) return copy.errors.notFound;
  if (f.status === 409) return copy.errors.conflict;
  if (f.status === 429) return copy.errors.rateLimited;
  if (f.status === 400 || f.status === 422) return copy.errors.validation;
  if (f.status === 0) return copy.errors.network;
  if (f.details.reason === "STORAGE_NOT_CONFIGURED") return copy.errors.storage;
  return copy.errors.generic;
}

/** Protected image: fetched with the bearer token when it nears the viewport. No public URL exists. */
export function AuthedImage({ evidenceId, variant = "thumb", alt, copy, eager }: { evidenceId: string; variant?: "thumb" | "full"; alt: string; copy: Copy; eager?: boolean }) {
  const [node, setNode] = useState<Element | null>(null);
  const img = useAuthedImage(evidenceId, variant, Boolean(eager), node);
  return (
    <span ref={setNode} role={img.state === "ready" ? "img" : undefined} aria-label={img.state === "ready" ? alt || copy.evidence.title : undefined}
      style={{ display: "block", width: "100%", height: "100%", ...(img.state === "ready" && img.url ? { backgroundImage: `url(${img.url})`, backgroundSize: variant === "full" ? "contain" : "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" } : {}) }}>
      {img.state === "ready" ? null : img.state === "error"
        ? <button type="button" className="ctr-btn is-ghost" onClick={(e) => { e.stopPropagation(); img.retry(); }} aria-label={copy.evidence.loadError}><ImageOffIcon aria-hidden="true" />{copy.common.retry}</button>
        : <span className="ins-skel" style={{ width: "100%", height: "100%" }} aria-label={copy.common.loading} />}
    </span>
  );
}

/** Reported (claimed, unverified) against measured/verified. Bars share one scale so the gap is visible at a glance. */
export function DualGauge({ claimed, verified, copy, labelClaimed, labelVerified }: { claimed: number | null; verified: number | null; copy: Copy; labelClaimed?: string; labelVerified?: string }) {
  const row = (k: "claimed" | "verified", label: string, v: number | null) => (
    <div className="ins-gauge-row"><span>{label}</span><span className="ins-gauge-track" role="img" aria-label={`${label}: ${v === null ? copy.common.notProvided : `${v}%`}`}>{v === null ? null : <i data-k={k} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />}</span><strong>{v === null ? "—" : `${v}%`}</strong></div>
  );
  return <div className="ins-gauge">{row("claimed", labelClaimed ?? copy.review.reportedClaim, claimed)}{row("verified", labelVerified ?? copy.review.measuredBy, verified)}</div>;
}

export const ppText = (pp: number | null, copy: Copy): string => (pp === null ? "—" : fill(copy.overview.discrepancy, { pp: pp > 0 ? `+${pp}` : String(pp) }));

/** Tiny custom SVG line chart, drawn only with at least two points. */
export function Sparkline({ reported, verified, copy }: { reported: { t: number; v: number }[]; verified: { t: number; v: number }[]; copy: Copy }) {
  const all = [...reported, ...verified];
  if (reported.length + verified.length < 2) return <p className="ins-muted">{copy.review.historyNeeds}</p>;
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t));
  const x = (t: number) => (t1 === t0 ? 50 : 4 + ((t - t0) / (t1 - t0)) * 92);
  const y = (v: number) => 46 - (Math.max(0, Math.min(100, v)) / 100) * 40;
  const path = (pts: { t: number; v: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg className="ins-sparkline" viewBox="0 0 100 50" preserveAspectRatio="none" role="img" aria-label={copy.review.history}>
      {reported.length > 1 ? <path d={path(reported)} stroke="var(--infra-orange)" /> : null}
      {verified.length > 1 ? <path d={path(verified)} stroke="var(--infra-green)" /> : null}
      {reported.map((p, i) => <circle key={`r${i}`} cx={x(p.t)} cy={y(p.v)} r="1.6" fill="var(--infra-orange)" />)}
      {verified.map((p, i) => <circle key={`v${i}`} cx={x(p.t)} cy={y(p.v)} r="1.8" fill="var(--infra-green)" />)}
    </svg>
  );
}
