"use client";

import { useEffect, useState } from "react";
import { AlarmClockIcon, ArchiveIcon, CheckIcon, ClockIcon, CrownIcon, InboxIcon, SlashIcon, XIcon } from "lucide-react";

import { fmt } from "@/lib/roadsync/assessment";
import { impactTone, initials, ringFraction, slaState, type AckStatus, type RecordRow, type RecordStatus, type TimeToImpact } from "@/lib/roadsync/conflict-records";
import { ringText, slaText, type ConflictCopy } from "@/lib/roadsync/conflict-records-copy";

import "@/styles/mission-control-roadsync-records.css";

/** Shared clock for SLA chips; one timer per consumer, cleared on unmount. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

const STATUS_ICON: Partial<Record<RecordStatus, typeof InboxIcon>> = { open: InboxIcon, acknowledged: CheckIcon, dismissed: XIcon, auto_closed: ArchiveIcon };

/** Status is never colour-only: shape (ring/strike/dash), icon and text always travel together. */
export function StatusPill({ status, copy, belowThreshold }: { status: RecordStatus; copy: ConflictCopy; belowThreshold?: boolean }) {
  const Icon = STATUS_ICON[status] ?? InboxIcon;
  return (
    <span className="cr-status-wrap">
      <span className="cr-status" data-status={status}><Icon aria-hidden="true" /><span>{copy.status[status] ?? status}</span></span>
      {belowThreshold ? <span className="cr-status" data-status="below"><span>{copy.belowThreshold}</span></span> : null}
    </span>
  );
}

/** Time-to-impact ring: depletes across the final 30 days before overlap start. Always paired with text. */
export function TimeRing({ t, copy, size = 40 }: { t: TimeToImpact; copy: ConflictCopy; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const tone = impactTone(t);
  const frac = t.state === "upcoming" ? ringFraction(t.days) : t.state === "active" ? 1 : 0;
  const text = ringText(copy, t);
  const center = t.state === "upcoming" ? `${t.days}d` : t.state === "active" ? `${t.dayIndex}/${t.totalDays}` : "—";
  return (
    <span className="cr-ring" data-tone={tone} title={text}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={fmt(copy.ring.aria, { text })}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
        <circle className="cr-ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${frac * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.27} fontWeight="700" fill="currentColor">{center}</text>
      </svg>
      {t.state === "active" ? <span className="cr-pulse" aria-hidden="true" /> : null}
      <span className="cr-ring-text">{text}</span>
    </span>
  );
}

export function SlaChip({ due, now, copy, locale }: { due: string | null; now: number; copy: ConflictCopy; locale: string }) {
  const s = slaState(due, now);
  if (s.kind === "none") return null;
  const Icon = s.kind === "overdue" ? AlarmClockIcon : ClockIcon;
  const when = due ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(due)) : "";
  return (
    <span className="cr-sla" data-state={s.kind} title={fmt(copy.sla.tooltip, { when })}>
      <Icon aria-hidden="true" /><span>{slaText(copy, s)}</span>
    </span>
  );
}

/** Per-agency acknowledgement: hollow ring + clock = pending, filled check = acknowledged, dashed slash = excluded. */
export function AckRing({ status, excluded, size = 22, label }: { status: AckStatus; excluded?: boolean; size?: number; label: string }) {
  const r = size / 2 - 2;
  return (
    <svg className="cr-ack" data-state={excluded ? "excluded" : status} width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill={status === "acknowledged" && !excluded ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeDasharray={excluded ? "3 2" : undefined} />
      {excluded ? <path d={`M${size * 0.3} ${size * 0.7} L${size * 0.7} ${size * 0.3}`} stroke="currentColor" strokeWidth="2" /> : status === "acknowledged" ? <path className="cr-check" d={`M${size * 0.28} ${size * 0.52} l${size * 0.14} ${size * 0.14} l${size * 0.3} -${size * 0.3}`} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : <path d={`M${size / 2} ${size * 0.3} V${size / 2} l${size * 0.14} ${size * 0.1}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

/** One segment per REQUIRED agency, filled when acknowledged; the viewer's own segment is outlined. */
export function AckSegments({ row, copy }: { row: RecordRow; copy: ConflictCopy }) {
  const required = row.affectedAgencies.filter((a) => a.active && a.required);
  return (
    <span className="cr-segs" role="img" aria-label={fmt(copy.row.ackProgress, row.ackProgress)}>
      {required.map((a) => (
        <span key={a.agencyId} className="cr-seg" data-done={a.ackStatus === "acknowledged"} data-mine={row.myAgency?.agencyId === a.agencyId} title={`${a.agencyName ?? ""} · ${copy.ack[a.ackStatus === "acknowledged" ? "acknowledged" : "pending"]}`} />
      ))}
      <span className="cr-segs-text">{row.ackProgress.done}/{row.ackProgress.required}</span>
    </span>
  );
}

export function AgencyDisc({ name, status, lead, excluded, size = 34 }: { name: string | null; status: AckStatus; lead?: boolean; excluded?: boolean; size?: number }) {
  return (
    <span className="cr-disc" data-state={excluded ? "excluded" : status} style={{ width: size, height: size }}>
      <span aria-hidden="true">{initials(name)}</span>
      {excluded ? <SlashIcon className="cr-disc-badge" aria-hidden="true" /> : null}
      {lead ? <CrownIcon className="cr-disc-crown" aria-hidden="true" /> : null}
    </span>
  );
}
