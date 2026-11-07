"use client";

import { AlertTriangleIcon, ArchiveIcon, CheckCircle2Icon, CircleDashedIcon, ClockIcon, MinusCircleIcon, PauseCircleIcon, ShieldAlertIcon, ShieldCheckIcon, XCircleIcon, InfoIcon } from "lucide-react";
import type { ReactNode } from "react";

import { initialsOf } from "@/lib/contractors/format";
import type { Copy } from "@/lib/contractors/messages";
import type { Assignment, CertCounts, ContractorStatus, EvidenceLevel, RiskBand, Severity } from "@/lib/contractors/types";

type Tone = "success" | "pending" | "critical" | "neutral" | "active";

export function Badge({ tone = "neutral", icon, children, title }: { tone?: Tone; icon?: ReactNode; children: ReactNode; title?: string }) {
  return (
    <span className="ctr-badge" data-tone={tone} title={title}>
      {icon}
      {children}
    </span>
  );
}

const STATUS_ICON = { ACTIVE: CheckCircle2Icon, SUSPENDED: PauseCircleIcon, INACTIVE: MinusCircleIcon, ARCHIVED: ArchiveIcon } as const;
const STATUS_TONE: Record<ContractorStatus, Tone> = { ACTIVE: "success", SUSPENDED: "pending", INACTIVE: "neutral", ARCHIVED: "neutral" };

export function StatusBadge({ status, copy }: { status: ContractorStatus; copy: Copy }) {
  const Icon = STATUS_ICON[status] ?? MinusCircleIcon;
  return <Badge tone={STATUS_TONE[status] ?? "neutral"} icon={<Icon aria-hidden="true" />} title={copy.statusHelp[status]}>{copy.statuses[status] ?? status}</Badge>;
}

/** Worst state wins: expired, then expiring, then valid. Counts are shown as text, so the chip never relies on colour. */
export function CertChip({ counts, copy }: { counts: CertCounts; copy: Copy }) {
  const summary = copy.cert.summary.replace("{valid}", String(counts.valid)).replace("{expiring}", String(counts.expiring)).replace("{expired}", String(counts.expired));
  if (counts.expired > 0) return <Badge tone="critical" icon={<XCircleIcon aria-hidden="true" />} title={summary}>{copy.cert.EXPIRED} · {counts.expired}</Badge>;
  if (counts.expiring > 0) return <Badge tone="pending" icon={<ClockIcon aria-hidden="true" />} title={summary}>{copy.cert.EXPIRING} · {counts.expiring}</Badge>;
  if (counts.valid > 0) return <Badge tone="success" icon={<ShieldCheckIcon aria-hidden="true" />} title={summary}>{copy.cert.VALID} · {counts.valid}</Badge>;
  return <Badge icon={<CircleDashedIcon aria-hidden="true" />}>{copy.cert.none}</Badge>;
}

const LEVEL_FILL: Record<EvidenceLevel, number> = { NONE: 0, LOW: 1, MODERATE: 3, GOOD: 4 };

/** Four segments plus the level word, so the meter reads without colour. */
export function EvidenceMeter({ level, copy }: { level: EvidenceLevel | null | undefined; copy: Copy }) {
  if (!level) return <span className="ctr-muted">{copy.common.restricted}</span>;
  const fill = LEVEL_FILL[level];
  return (
    <span className="ctr-meter" role="img" aria-label={copy.evidence.meter.replace("{level}", copy.evidence[level])}>
      <span className="ctr-meter-bar" aria-hidden="true">{[0, 1, 2, 3].map((i) => <i key={i} className={i < fill ? "is-on" : undefined} />)}</span>
      <span aria-hidden="true">{copy.evidence[level]}</span>
    </span>
  );
}

const BAND_TONE: Record<RiskBand, Tone> = { STRONG: "success", MIXED: "pending", WEAK: "critical", NOT_ENOUGH_EVIDENCE: "neutral" };
const BAND_ICON = { STRONG: ShieldCheckIcon, MIXED: AlertTriangleIcon, WEAK: ShieldAlertIcon, NOT_ENOUGH_EVIDENCE: CircleDashedIcon } as const;

export function BandChip({ band, copy }: { band: RiskBand | null | undefined; copy: Copy }) {
  const value: RiskBand = band ?? "NOT_ENOUGH_EVIDENCE";
  const Icon = BAND_ICON[value];
  return <Badge tone={BAND_TONE[value]} icon={<Icon aria-hidden="true" />}>{copy.band[value]}</Badge>;
}

const SEVERITY_ICON = { LOW: InfoIcon, MEDIUM: AlertTriangleIcon, HIGH: ShieldAlertIcon } as const;
const SEVERITY_TONE: Record<Severity, Tone> = { LOW: "neutral", MEDIUM: "pending", HIGH: "critical" };
export function SeverityBadge({ severity, copy }: { severity: Severity; copy: Copy }) {
  const Icon = SEVERITY_ICON[severity];
  return <Badge tone={SEVERITY_TONE[severity]} icon={<Icon aria-hidden="true" />}>{copy.flags.severity[severity]}</Badge>;
}

export function RoleBadge({ role, copy }: { role: Assignment["role"]; copy: Copy }) {
  return <Badge tone={role === "PRIMARY" ? "active" : "neutral"}>{copy.roles[role]}</Badge>;
}

export function AssignmentStatusBadge({ status, copy }: { status: Assignment["status"]; copy: Copy }) {
  const tone: Tone = status === "ACTIVE" ? "success" : status === "TERMINATED" ? "critical" : "neutral";
  return <Badge tone={tone}>{copy.assignmentStatus[status]}</Badge>;
}

export function Initials({ name, large }: { name: string; large?: boolean }) {
  return <span className={large ? "ctr-tile is-large" : "ctr-tile"} aria-hidden="true">{initialsOf(name)}</span>;
}

export function Skeleton({ height = "1rem", width = "100%" }: { height?: string; width?: string }) {
  return <span className="ctr-skel" style={{ height, width }} aria-hidden="true" />;
}

export function Restricted({ copy, text }: { copy: Copy; text?: string }) {
  return <span className="ctr-restricted">{text ?? copy.common.restricted}</span>;
}
