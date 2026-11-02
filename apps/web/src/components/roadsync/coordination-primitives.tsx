"use client";

import { AlarmClockIcon, ArrowLeftRightIcon, CheckIcon, ClockIcon, EyeIcon, FlagIcon, HelpCircleIcon, ListChecksIcon, ShieldCheckIcon, UndoIcon, UnlinkIcon, XIcon, type LucideIcon } from "lucide-react";

import { fmt } from "@/lib/roadsync/assessment";
import { clockState, diffLines, initialsOf, type CoordStatus, type ParticipantRow, type Proposal, type Stance } from "@/lib/roadsync/coordination";
import { clockText, type CoordCopy } from "@/lib/roadsync/coordination-copy";

import "@/styles/mission-control-roadsync-coordination.css";

const STANCE_ICON: Record<Stance, LucideIcon> = { proposer: FlagIcon, pending: ClockIcon, accepted: CheckIcon, conditional: ListChecksIcon, countered: ArrowLeftRightIcon, needs_info: HelpCircleIcon, declined: XIcon };

/** Stance is never colour-only: ring shape (solid, hollow, half, dashed), icon and text always travel together. */
export function StanceDisc({ stance, consulted, name, size = 34, label }: { stance: Stance; consulted?: boolean; name: string | null; size?: number; label?: string }) {
  const Icon = STANCE_ICON[stance];
  return (
    <span className="co-disc" data-stance={stance} data-consulted={consulted || undefined} style={{ width: size, height: size }} role="img" aria-label={label}>
      <span aria-hidden="true">{initialsOf(name)}</span>
      <span className="co-disc-badge" aria-hidden="true">{consulted ? <EyeIcon /> : <Icon />}</span>
    </span>
  );
}

export function StanceChip({ stance, copy }: { stance: Stance; copy: CoordCopy }) {
  const Icon = STANCE_ICON[stance];
  return <span className="co-stance" data-stance={stance}><Icon aria-hidden="true" /><span>{copy.stance[stance]}</span></span>;
}

const STATUS_ICON: Record<CoordStatus, LucideIcon> = { awaiting_response: ClockIcon, negotiating: ArrowLeftRightIcon, agreed: ShieldCheckIcon, no_agreement: UnlinkIcon, withdrawn: UndoIcon };
export function StatusChip({ status, escalated, copy }: { status: CoordStatus; escalated?: boolean; copy: CoordCopy }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className="co-chips">
      <span className="co-status" data-status={status}><Icon aria-hidden="true" /><span>{copy.status[status]}</span></span>
      {escalated ? <span className="co-status" data-status="escalated"><FlagIcon aria-hidden="true" /><span>{copy.escalatedChip}</span></span> : null}
    </span>
  );
}

/** One segment per REQUIRED participant, filled by stance; consulted shown as dashed ticks outside the bar. */
export function AgreementMeter({ participants, copy, large }: { participants: ParticipantRow[]; copy: CoordCopy; large?: boolean }) {
  const required = participants.filter((p) => p.required && p.stance !== "proposer" && p.role !== "consulted");
  const consulted = participants.filter((p) => p.role === "consulted");
  const done = required.filter((p) => p.stance === "accepted").length;
  return (
    <span className="co-meter" data-large={large || undefined} role="img" aria-label={fmt(copy.meter.aria, { done, required: required.length, consulted: consulted.length })}>
      <span className="co-meter-bar">{required.map((p) => <span key={p.agencyId} className="co-seg" data-stance={p.stance} title={`${p.agencyName ?? ""} · ${copy.stance[p.stance]}`} />)}</span>
      <span className="co-meter-text">{fmt(copy.meter.text, { done, required: required.length })}</span>
      {consulted.length ? <span className="co-ticks" title={copy.meter.consulted}>{consulted.map((p) => <span key={p.agencyId} className="co-tick" data-stance={p.stance} title={`${p.agencyName ?? ""} · ${copy.stance[p.stance]}`} />)}</span> : null}
      <table className="sr-only"><thead><tr><th>{copy.meter.tableAgency}</th><th>{copy.meter.tableStance}</th></tr></thead><tbody>{participants.map((p) => <tr key={p.agencyId}><td>{p.agencyName}</td><td>{copy.stance[p.stance]}</td></tr>)}</tbody></table>
    </span>
  );
}

export function DeadlineClock({ at, closed, now, copy, locale, warn }: { at: string | null; closed: boolean; now: number; copy: CoordCopy; locale: string; warn?: boolean }) {
  const s = clockState(at, closed, now);
  const when = at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(at)) : "";
  const Icon = s.kind === "overdue" ? AlarmClockIcon : ClockIcon;
  return (
    <span className="co-clock" data-state={s.kind} data-warn={warn || undefined} title={fmt(copy.clock.tooltip, { when })}>
      <Icon aria-hidden="true" /><span>{clockText(copy, s)}</span>{warn ? <small>{copy.clock.warn}</small> : null}
    </span>
  );
}

const fmtDate = (v: unknown, locale: string) => (typeof v === "string" && v ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Colombo" }).format(new Date(v)) : "");

/** Before | After with changed fields highlighted. Every change also has a plain-text sentence. */
export function ProposalDiff({ proposal, copy, locale, agencyName }: { proposal: Proposal; copy: CoordCopy; locale: string; agencyName?: (id: string) => string | null }) {
  const show = (field: string, v: unknown): string => {
    if (v === null || v === undefined) return copy.diff.none;
    if (field === "workingHours") return copy.hours[String(v)] ?? String(v);
    if (field === "measures" && Array.isArray(v)) return v.map((m) => copy.measures[String(m)] ?? String(m)).join(", ");
    if (field === "questions" && Array.isArray(v)) return v.join(" · ");
    if (field === "slots" && Array.isArray(v)) return v.map((s) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(String(s)))).join(", ");
    if (field === "mode") return v === "onsite" ? copy.diff.onsite : copy.diff.online;
    if (field === "leadAgency") return agencyName?.(String(v)) ?? String(v);
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDate(v, locale);
    return String(v);
  };
  const lines = diffLines(proposal);
  return (
    <div className="co-diff">
      <table>
        <thead><tr><th /><th>{copy.diff.before}</th><th>{copy.diff.after}</th></tr></thead>
        <tbody>
          {lines.map((l) => {
            const changed = l.before !== null && l.before !== undefined && show(l.field, l.before) !== show(l.field, l.after);
            const field = copy.fields[l.field] ?? l.field;
            const text = l.deltaDays !== undefined && l.before ? fmt(copy.diff.moved, { field, from: show(l.field, l.before), to: show(l.field, l.after), delta: `${l.deltaDays > 0 ? "+" : ""}${l.deltaDays}` }) : changed ? fmt(copy.diff.moved, { field, from: show(l.field, l.before), to: show(l.field, l.after), delta: "" }).replace(/, $/, "") : fmt(copy.diff.set, { field, to: show(l.field, l.after) });
            return (
              <tr key={l.field} data-changed={changed || undefined}>
                <th scope="row">{field}</th>
                <td>{show(l.field, l.before)}</td>
                <td><strong>{show(l.field, l.after)}</strong>{l.deltaDays ? <span className="co-delta">{l.deltaDays > 0 ? "+" : ""}{l.deltaDays} d</span> : null}</td>
                <td className="sr-only">{text}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AvatarStack({ participants, copy }: { participants: ParticipantRow[]; copy: CoordCopy }) {
  return (
    <span className="co-stack">
      {participants.map((p) => <StanceDisc key={p.agencyId} stance={p.stance} consulted={p.role === "consulted"} name={p.agencyName} size={28} label={`${p.agencyName ?? ""}: ${copy.stance[p.stance]}`} />)}
    </span>
  );
}
