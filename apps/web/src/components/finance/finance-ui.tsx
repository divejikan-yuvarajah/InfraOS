"use client";

import { AlertTriangleIcon, BanIcon, CheckCircle2Icon, CircleDashedIcon, ClockIcon, InfoIcon, MinusCircleIcon, ShieldAlertIcon, ShieldCheckIcon, Undo2Icon as ArrowUturnLeftIcon, WalletIcon, XCircleIcon } from "lucide-react";
import { useId, useState } from "react";

import type { AuthLocale } from "@/lib/auth/types";
import { formatLkr, formatLkrCompact, parseAmount, percentFromBp, splitLkr } from "@/lib/finance/money";
import type { Copy } from "@/lib/finance/messages";
import { flagText, gateText } from "@/lib/finance/view";
import { stepsFor } from "@/lib/finance/view";
import type { Basis, ExpenseStatus, Flag, FlagLite, Gate, PaymentStatus, Revision, Severity } from "@/lib/finance/types";

import "@/styles/contractors.css";
import "@/styles/finance.css";

type Tone = "success" | "pending" | "critical" | "neutral" | "active";

export function Chip({ tone = "neutral", icon, children, title }: { tone?: Tone; icon?: React.ReactNode; children: React.ReactNode; title?: string }) {
  return <span className="ctr-badge" data-tone={tone} title={title}>{icon}{children}</span>;
}

const PAY_ICON = { PENDING: ClockIcon, APPROVED: CheckCircle2Icon, PAID: WalletIcon, REJECTED: XCircleIcon, CANCELLED: BanIcon, REVERSED: ArrowUturnLeftIcon } as const;
const PAY_TONE: Record<PaymentStatus, Tone> = { PENDING: "pending", APPROVED: "active", PAID: "success", REJECTED: "critical", CANCELLED: "neutral", REVERSED: "neutral" };
export function PaymentChip({ status, copy }: { status: PaymentStatus; copy: Copy }) {
  const Icon = PAY_ICON[status] ?? MinusCircleIcon;
  return <Chip tone={PAY_TONE[status] ?? "neutral"} icon={<Icon aria-hidden="true" />}>{copy.paymentStatus[status] ?? status}</Chip>;
}

const EXP_ICON = { DRAFT: CircleDashedIcon, PENDING_VERIFICATION: ClockIcon, VERIFIED: ShieldCheckIcon, REJECTED: XCircleIcon, REVERSED: ArrowUturnLeftIcon } as const;
const EXP_TONE: Record<ExpenseStatus, Tone> = { DRAFT: "neutral", PENDING_VERIFICATION: "pending", VERIFIED: "success", REJECTED: "critical", REVERSED: "neutral" };
export function ExpenseChip({ status, copy }: { status: ExpenseStatus; copy: Copy }) {
  const Icon = EXP_ICON[status] ?? MinusCircleIcon;
  return <Chip tone={EXP_TONE[status] ?? "neutral"} icon={<Icon aria-hidden="true" />}>{copy.expenseStatus[status] ?? status}</Chip>;
}

export function RevisionChip({ status, copy }: { status: Revision["status"]; copy: Copy }) {
  const tone: Tone = status === "APPROVED" ? "success" : status === "PENDING_APPROVAL" ? "pending" : status === "REJECTED" ? "critical" : "neutral";
  const Icon = status === "APPROVED" ? CheckCircle2Icon : status === "PENDING_APPROVAL" ? ClockIcon : status === "REJECTED" ? XCircleIcon : BanIcon;
  return <Chip tone={tone} icon={<Icon aria-hidden="true" />}>{copy.revisionStatus[status]}</Chip>;
}

/** Progress basis: verified progress is a check mark, anything else says "not verified" in words. */
export function BasisBadge({ basis, copy }: { basis: Basis; copy: Copy }) {
  if (basis === "VERIFIED_INSPECTION") return <Chip tone="success" icon={<ShieldCheckIcon aria-hidden="true" />}>{copy.basis.VERIFIED_INSPECTION} ✔</Chip>;
  if (basis === "REPORTED_UNVERIFIED") return <Chip tone="pending" icon={<AlertTriangleIcon aria-hidden="true" />}>{copy.basis.REPORTED_UNVERIFIED}</Chip>;
  return <Chip icon={<CircleDashedIcon aria-hidden="true" />}>{copy.basis.NONE}</Chip>;
}

const SEV_TONE: Record<Severity, Tone> = { INFO: "neutral", LOW: "neutral", MEDIUM: "pending", HIGH: "critical" };
const SEV_ICON = { INFO: InfoIcon, LOW: InfoIcon, MEDIUM: AlertTriangleIcon, HIGH: ShieldAlertIcon } as const;
export function SeverityChip({ severity, copy }: { severity: Severity; copy: Copy }) {
  const Icon = SEV_ICON[severity];
  return <Chip tone={SEV_TONE[severity]} icon={<Icon aria-hidden="true" />}>{copy.flags.severity[severity]}</Chip>;
}

/** Renders `Rs. 12,450,000.00` with a muted prefix and de-emphasised cents; the exact value is always the accessible name. */
export function MoneyText({ minor, locale, compact, copy, over }: { minor: number | null | undefined; locale: AuthLocale; compact?: boolean; copy?: Copy; over?: boolean }) {
  if (minor === null || minor === undefined || !Number.isSafeInteger(minor)) return <span className="ctr-muted">—</span>;
  const exact = formatLkr(minor, locale);
  if (compact && copy) return <span className="fin-money ctr-num" title={exact} aria-label={exact}>{formatLkrCompact(minor, locale, copy.units)}</span>;
  const s = splitLkr(minor, locale);
  return (
    <span className={over ? "fin-money is-over ctr-num" : "fin-money ctr-num"} aria-label={over && copy ? copy.money.overBy.replace("{amount}", exact) : exact}>
      <span className="fin-cur">{s.prefix}</span> {s.whole}<span className="fin-cents">.{s.cents}</span>
    </span>
  );
}

/** String-only amount field. Shows grouping on blur, rejects (never rounds) bad input, numeric keypad on phones. */
export function MoneyInput({ label, value, onChange, error, hint, required, copy, disabled }: { label: string; value: string; onChange: (v: string) => void; error?: string | null; hint?: string; required?: boolean; copy: { required: string; money: string }; disabled?: boolean }) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const parsed = parseAmount(value);
  const own = touched && value.trim() !== "" && !parsed.ok ? copy.money : touched && required && value.trim() === "" ? copy.required : null;
  const shown = error ?? own;
  return (
    <div className="ctr-field">
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      <input id={id} className="ctr-input ctr-num fin-amount" inputMode="decimal" autoComplete="off" value={value} disabled={disabled} aria-invalid={Boolean(shown)} aria-describedby={`${id}-d`} placeholder="0.00"
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={() => { setTouched(true); if (parsed.ok) onChange(groupCanonical(parsed.canonical)); }} />
      <p className="ctr-small" id={`${id}-d`}>{hint ?? "Rs."}</p>
      {shown ? <p className="ctr-error" role="alert">{shown}</p> : null}
    </div>
  );
}
/** "1250000.50" to "1,250,000.50" by string grouping (no number conversion). */
export function groupCanonical(canonical: string): string {
  const [whole = "0", frac = "00"] = canonical.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
}

export function RecordingNote({ copy }: { copy: Copy }) {
  return <p className="fin-note" role="note"><InfoIcon aria-hidden="true" width={14} height={14} /> {copy.recordingOnly}</p>;
}

/** SVG utilization ring with threshold ticks at 80, 95 and 100 percent. Null means unavailable, never an empty ring. */
export function UtilizationRing({ bp, copy, size = 96 }: { bp: number | null; copy: Copy; size?: number }) {
  const r = 40, c = 2 * Math.PI * r;
  const frac = bp === null ? 0 : Math.min(1, bp / 10000);
  const tone = bp === null ? "none" : bp > 10000 ? "over" : bp >= 9500 ? "high" : bp >= 8000 ? "warn" : "ok";
  const tick = (pct: number) => { const a = (pct / 100) * 2 * Math.PI - Math.PI / 2; return { x1: 50 + (r - 6) * Math.cos(a), y1: 50 + (r - 6) * Math.sin(a), x2: 50 + (r + 6) * Math.cos(a), y2: 50 + (r + 6) * Math.sin(a) }; };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${copy.kpi.utilization}: ${bp === null ? copy.money.unavailable : percentFromBp(bp)}`} className="fin-ring" data-tone={tone}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="9" />
      {bp !== null ? <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 50 50)" /> : null}
      {[80, 95].map((t) => <line key={t} {...tick(t)} stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" />)}
      <text x="50" y="55" textAnchor="middle" className="fin-ring-text">{bp === null ? "—" : percentFromBp(bp)}</text>
    </svg>
  );
}

/** Paid share against physical progress as two stacked bars plus the basis badge, so a gap is visible without reading numbers. */
export function DualBar({ financialBp, physicalBp, basis, copy }: { financialBp: number | null; physicalBp: number | null; basis: Basis; copy: Copy }) {
  const w = (bp: number | null) => `${bp === null ? 0 : Math.min(100, bp / 100)}%`;
  return (
    <div className="fin-dual" role="group" aria-label={`${copy.intel.financial} ${percentFromBp(financialBp)}, ${copy.intel.physical} ${physicalBp === null ? copy.money.unavailable : percentFromBp(physicalBp)}`}>
      <div className="fin-dual-row"><span>{copy.intel.financial}</span><i className="fin-bar"><b className="is-fin" style={{ width: w(financialBp) }} /></i><span className="ctr-num">{percentFromBp(financialBp)}</span></div>
      <div className="fin-dual-row"><span>{copy.intel.physical}</span><i className="fin-bar"><b className={basis === "VERIFIED_INSPECTION" ? "is-phys" : "is-phys is-reported"} style={{ width: w(physicalBp) }} /></i><span className="ctr-num">{physicalBp === null ? "—" : percentFromBp(physicalBp)}</span></div>
      <BasisBadge basis={basis} copy={copy} />
    </div>
  );
}

const GATE_ICON = { PASS: CheckCircle2Icon, WARN: AlertTriangleIcon, BLOCK: ShieldAlertIcon, SKIPPED: MinusCircleIcon } as const;
const GATE_TONE: Record<Gate["status"], Tone> = { PASS: "success", WARN: "pending", BLOCK: "critical", SKIPPED: "neutral" };
export function GateChecklist({ gates, copy, locale, loading }: { gates: Gate[]; copy: Copy; locale: AuthLocale; loading?: boolean }) {
  return (
    <section className="fin-gates" aria-label={copy.gates.title} aria-live="polite" aria-busy={loading}>
      <h3>{copy.gates.title} <span className="ctr-small">· {copy.gates.live}</span></h3>
      <ul>
        {gates.map((g) => {
          const Icon = GATE_ICON[g.status];
          return (
            <li key={g.key} data-status={g.status}>
              <Chip tone={GATE_TONE[g.status]} icon={<Icon aria-hidden="true" />}>{copy.gates.status[g.status]}</Chip>
              <div><strong>{copy.gates.name[g.key]}</strong><p className="ctr-small">{gateText(copy, g, locale)}</p></div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const STEP_ICON = { requested: ClockIcon, approved: CheckCircle2Icon, paid: WalletIcon, rejected: XCircleIcon, cancelled: BanIcon, reversed: ArrowUturnLeftIcon } as const;
export function PaymentStepper({ status, copy, compact, who }: { status: string; copy: Copy; compact?: boolean; who?: Partial<Record<string, string | null>> }) {
  return (
    <ol className={compact ? "fin-stepper is-compact" : "fin-stepper"} aria-label={copy.paymentStatus[status as PaymentStatus] ?? status}>
      {stepsFor(status).map((s) => {
        const Icon = STEP_ICON[s.key];
        return (
          <li key={s.key} data-state={s.state} aria-current={s.state === "current" ? "step" : undefined}>
            <Icon aria-hidden="true" width={16} height={16} />
            <span>{copy.stepper[s.key]}</span>
            {!compact && who?.[s.key] ? <small>{copy.stepper.by.replace("{name}", who[s.key] as string)}</small> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Flag card with plain-language reason, severity and confidence; indicative flags explain why they are indicative. */
export function FlagCard({ flag, copy, locale, basis, extra }: { flag: Flag | (FlagLite & { params?: Record<string, string | number>; reason?: string }); copy: Copy; locale: AuthLocale; basis?: Basis; extra?: React.ReactNode }) {
  const t = flagText(copy, { code: flag.code, params: (flag as Flag).params ?? {} }, locale, { basis });
  return (
    <article className="ctr-flag" data-severity={flag.severity === "INFO" ? "LOW" : flag.severity}>
      <div className="ctr-flag-head"><SeverityChip severity={flag.severity} copy={copy} /><span>{t.label}</span><Chip tone={flag.confidence === "CONFIRMED" ? "success" : "pending"}>{copy.flags.confidence[flag.confidence]}</Chip></div>
      <p className="ctr-small" style={{ color: "var(--infra-text)" }}>{t.reason}</p>
      {flag.confidence === "INDICATIVE" ? <p className="ctr-small">{copy.flags.indicativeNote}</p> : null}
      {extra}
    </article>
  );
}
