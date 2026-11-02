"use client";

import { useMemo, useState } from "react";
import { CrownIcon, XIcon } from "lucide-react";

import { fmt } from "@/lib/roadsync/assessment";
import { orbitOf, roleWeight, type AffectedView, type Dossier } from "@/lib/roadsync/conflict-records";
import { reasonText, type ConflictCopy } from "@/lib/roadsync/conflict-records-copy";
import { BAND_COLOR } from "@/lib/roadsync/assessment";

import { AckRing, AgencyDisc, SlaChip } from "./conflict-primitives";

const W = 520;
const H = 470;
const CX = W / 2;
const CY = H / 2;
const ORBIT = [92, 152, 208] as const;

type Placed = AffectedView & { x: number; y: number; orbit: 0 | 1 | 2; r: number };

/** Deterministic radial layout: parties inner, asset owners middle, nearby work outer. */
export function layoutNodes(affected: AffectedView[]): Placed[] {
  const groups: AffectedView[][] = [[], [], []];
  for (const a of affected) groups[orbitOf(a.roles)]!.push(a);
  return groups.flatMap((g, orbit) => g.map((a, i) => {
    const angle = (-90 + (360 / Math.max(g.length, 1)) * i + orbit * 24) * (Math.PI / 180);
    const r = 14 + Math.max(...a.roles.map((role) => roleWeight[role])) * 3;
    return { ...a, orbit: orbit as 0 | 1 | 2, r, x: CX + ORBIT[orbit]! * Math.cos(angle), y: CY + ORBIT[orbit]! * Math.sin(angle) };
  }));
}

type Handlers = { onSetLead: (agencyId: string) => void; onExclude: (agencyId: string) => void; onRestore: (agencyId: string) => void; onAdd: () => void };

export function StakeholderConstellation({ d, copy, locale, now, bandLabel, canManage, handlers }: { d: Dossier; copy: ConflictCopy; locale: string; now: number; bandLabel: string; canManage: boolean; handlers: Handlers }) {
  const nodes = useMemo(() => layoutNodes(d.affected), [d.affected]);
  const [sel, setSel] = useState<string | null>(null);
  const selected = nodes.find((n) => n.agencyId === sel) ?? null;
  const c = copy.constellation;
  const move = (e: React.KeyboardEvent) => {
    if (!nodes.length) return;
    const i = Math.max(0, nodes.findIndex((n) => n.agencyId === sel));
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setSel(nodes[(i + 1) % nodes.length]!.agencyId); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setSel(nodes[(i - 1 + nodes.length) % nodes.length]!.agencyId); }
    else if (e.key === "Escape") setSel(null);
  };
  const ackLabel = (n: AffectedView) => (n.excluded ? copy.ack.excluded : copy.ack[n.ack.status === "acknowledged" ? "acknowledged" : "pending"]);
  const roleNames = (n: AffectedView) => n.roles.map((r) => copy.roles[r]).join(", ");
  const fmtDate = (v: string | null) => (v ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(v)) : "—");

  const card = selected ? (
    <div className="cr-stk-card" role="region" aria-label={selected.agencyName ?? ""}>
      <div className="cr-stk-head"><AgencyDisc name={selected.agencyName} status={selected.ack.status} lead={d.lead?.agencyId === selected.agencyId} excluded={Boolean(selected.excluded)} /><strong>{selected.agencyName}</strong><button type="button" className="rs-btn" onClick={() => setSel(null)} aria-label={c.close}><XIcon aria-hidden="true" /></button></div>
      <p>{roleNames(selected)} · <span className="rs-nb-chip">{selected.required ? copy.ack.required : copy.ack.informed}</span> <span className="rs-nb-chip">{selected.source === "manual" ? copy.ack.manual : copy.ack.auto}</span></p>
      <ul className="cr-reasons">{selected.reasons.map((r, i) => <li key={i}>{reasonText(copy, r.code, r.params)}</li>)}</ul>
      <p><AckRing status={selected.ack.status} excluded={Boolean(selected.excluded)} size={18} label={ackLabel(selected)} /> {ackLabel(selected)}{selected.ack.status === "acknowledged" ? ` · ${selected.ack.byName ?? selected.ack.byRole ?? ""} · ${fmtDate(selected.ack.at)}${selected.ack.onBehalf ? ` (${copy.ack.onBehalf})` : ""}` : ` · ${c.noAck}`}</p>
      {selected.ack.status === "pending" ? <SlaChip due={selected.ackDueAt} now={now} copy={copy} locale={locale} /> : null}
      {selected.inactiveReason ? <p className="rs-help">{copy.dossier.inactive}</p> : null}
      {canManage ? (
        <div className="cr-stk-actions">
          {selected.active && !selected.excluded && d.lead?.agencyId !== selected.agencyId ? <button type="button" className="rs-btn" onClick={() => handlers.onSetLead(selected.agencyId)}><CrownIcon aria-hidden="true" /> {copy.dossier.setLead}</button> : null}
          {selected.excluded ? <button type="button" className="rs-btn" onClick={() => handlers.onRestore(selected.agencyId)}>{copy.dossier.restore}</button>
            : selected.active ? <button type="button" className="rs-btn" onClick={() => handlers.onExclude(selected.agencyId)}>{copy.dossier.exclude}</button> : null}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <section className="cr-const" aria-label={c.title}>
      <div className="cr-const-head"><h3>{c.title}</h3>{canManage ? <button type="button" className="rs-btn" onClick={handlers.onAdd}>{copy.dossier.addAgency}</button> : null}</div>
      <p className="rs-help">{c.hint}</p>
      <div className="cr-const-stage" onKeyDown={move}>
        <svg className="cr-const-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={c.title}>
          {ORBIT.map((r, i) => <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="#cbd5e1" strokeDasharray="2 5" aria-hidden="true"><title>{[c.orbitParties, c.orbitAssets, c.orbitNearby][i]}</title></circle>)}
          {nodes.map((n) => <line key={`e-${n.agencyId}`} x1={CX} y1={CY} x2={n.x} y2={n.y} stroke="#64748b" strokeWidth={n.orbit === 0 ? 2.5 : 1.5} strokeDasharray={n.orbit === 0 ? undefined : n.orbit === 1 ? "7 4" : "2 4"} opacity={n.excluded ? 0.3 : 0.8} aria-hidden="true" />)}
          <g aria-hidden="true">
            <circle cx={CX} cy={CY} r="34" fill="#fff" stroke={BAND_COLOR[d.severity.band]} strokeWidth="6" />
            <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central" fontWeight="700" fontSize="20" fill="#0f172a">{d.severity.score}</text>
            <text x={CX} y={CY + 52} textAnchor="middle" fontSize="11" fill="#475569">{c.center} · {bandLabel}</text>
          </g>
          {nodes.map((n, i) => {
            const label = `${n.agencyName ?? ""}, ${roleNames(n)}, ${ackLabel(n)}`;
            const lead = d.lead?.agencyId === n.agencyId;
            return (
              <g key={n.agencyId} className="cr-node" data-state={n.excluded ? "excluded" : n.ack.status} data-selected={sel === n.agencyId} tabIndex={0} role="button" aria-pressed={sel === n.agencyId} aria-label={label} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                transform={`translate(${n.x} ${n.y})`} onClick={() => setSel(n.agencyId)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(n.agencyId); } }}>
                <circle r={n.r + 5} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={n.excluded ? "4 3" : undefined} opacity={n.ack.status === "acknowledged" && !n.excluded ? 1 : 0.7} />
                {n.ack.status === "acknowledged" && !n.excluded ? <circle r={n.r + 5} fill="currentColor" opacity="0.15" /> : null}
                <circle r={n.r} fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
                <text textAnchor="middle" dominantBaseline="central" fontSize={n.r * 0.7} fontWeight="700" fill="#0f172a">{(n.agencyName ?? "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</text>
                {lead ? <text y={-n.r - 9} textAnchor="middle" fontSize="14" aria-hidden="true">♛</text> : null}
              </g>
            );
          })}
        </svg>
        {card}
      </div>
      <div className="cr-const-list">
        {([0, 1, 2] as const).map((o) => {
          const g = nodes.filter((n) => n.orbit === o);
          return g.length ? <div key={o}><h4>{[c.orbitParties, c.orbitAssets, c.orbitNearby][o]}</h4><ul>{g.map((n) => <li key={n.agencyId}><button type="button" className="cr-stk-li" onClick={() => setSel(n.agencyId)}><AgencyDisc name={n.agencyName} status={n.ack.status} lead={d.lead?.agencyId === n.agencyId} excluded={Boolean(n.excluded)} size={30} /><span>{n.agencyName}<small>{roleNames(n)}</small></span></button></li>)}</ul></div> : null;
        })}
      </div>
      <table className="sr-only">
        <caption>{c.table}</caption>
        <thead><tr><th>{c.agency}</th><th>{c.roles}</th><th>{c.ack}</th><th>{c.due}</th><th>{c.reasons}</th></tr></thead>
        <tbody>{nodes.map((n) => <tr key={n.agencyId}><td>{n.agencyName}</td><td>{roleNames(n)}</td><td>{ackLabel(n)}</td><td>{fmtDate(n.ackDueAt)}</td><td>{n.reasons.map((r) => reasonText(copy, r.code, r.params)).join("; ")}</td></tr>)}</tbody>
      </table>
      <p className="sr-only">{fmt(copy.dossier.ackSummary, d.ackProgress)}</p>
    </section>
  );
}
