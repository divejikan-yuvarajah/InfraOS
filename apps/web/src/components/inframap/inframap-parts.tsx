"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ExternalLinkIcon, SearchIcon, XIcon } from "lucide-react";

import { StatusChip } from "@/components/site-plan/site-plan";
import { useWorkspaceLocale } from "@/lib/i18n/workspace-locale";
import { searchLoaded, summarize, type LayerData, type LayerKey, type MapFeature, type SearchHit } from "@/lib/inframap/inframap";
import type { ConflictEvidence } from "@/lib/inframap/inframap-api";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";
import { LAYER_BY_ID, type LegendEntry } from "@/lib/inframap/layer-registry";
import type { Candidate } from "@/lib/inframap/selection-priority";
import { fmt, type Band } from "@/lib/roadsync/assessment";
import { getAssessmentCopy } from "@/lib/roadsync/assessment-copy";
import { getConflictCopy } from "@/lib/roadsync/conflict-records-copy";
import { getResolutionCopy } from "@/lib/roadsync/resolution-copy";
import { getWorkRequestCopy } from "@/lib/roadsync/work-request-copy";
import { CLOSED_CONFLICT_STATUSES } from "@/lib/inframap/inframap";

type Locale = "en" | "si" | "ta";
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const dateFmt = (locale: string, iso: unknown) => (typeof iso === "string" && iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Asia/Colombo" }).format(new Date(iso)) : null);
const range = (locale: string, a: unknown, b: unknown) => [dateFmt(locale, a), dateFmt(locale, b)].filter(Boolean).join(" → ") || null;

/** Translated label for a filter value or legend id. Stored data (titles, agency names, numbers) is never translated. */
export function valueLabel(layer: LayerKey, value: string, copy: InframapCopy, locale: Locale): string {
  const work = getWorkRequestCopy(locale).list;
  const bands = getAssessmentCopy(locale).bands as Record<string, string>;
  if (value === "overdue" || value === "1") return copy.values.overdue!;
  if (copy.values[value]) return copy.values[value]!;
  if (layer === "conflicts") return bands[value] ?? value;
  if (layer === "roadworks") return work.statuses[value] ?? value;
  return copy.projectStatus[value] ?? value.replace(/_/g, " ").toLowerCase();
}

export function LegendShape({ entry }: { entry: LegendEntry }) {
  return <i className="im-sw" data-shape={entry.shape} style={{ ["--c" as string]: entry.color }} aria-hidden="true" />;
}

export function Legend({ copy, locale, visible }: { copy: InframapCopy; locale: Locale; visible: Record<LayerKey, boolean> }) {
  return (
    <details className="im-legend" open>
      <summary>{copy.controls.legend}</summary>
      {(Object.keys(visible) as LayerKey[]).filter((k) => visible[k]).map((k) => (
        <div key={k}>
          <p className="im-legend-h">{copy.layers[k]}</p>
          <ul>{LAYER_BY_ID[k].legend.map((e) => <li key={e.id}><LegendShape entry={e} />{valueLabel(k, e.id, copy, locale)}</li>)}</ul>
        </div>
      ))}
      <p className="rs-help">{copy.more.layersLegendNote}</p>
    </details>
  );
}

/** Search over the loaded features. Props are shaped so a server-side search can replace `searchLoaded` later. */
export function SearchBox({ data, enabled, copy, onSelect }: { data: Partial<Record<LayerKey, LayerData>>; enabled: Record<LayerKey, boolean>; copy: InframapCopy; onSelect: (hit: SearchHit) => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const hits = searchLoaded(data, enabled, q);
  const listId = "im-search-list";
  const choose = (hit: SearchHit | undefined) => { if (hit) { onSelect(hit); setQ(""); } };
  return (
    <div className="im-search" role="search">
      <label className="im-search-box">
        <SearchIcon aria-hidden="true" />
        <span className="sr-only">{copy.search.label}</span>
        <input
          type="search" value={q} placeholder={copy.search.placeholder} autoComplete="off" role="combobox" aria-expanded={hits.length > 0} aria-controls={listId} aria-activedescendant={hits[active] ? `im-hit-${active}` : undefined}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((n) => Math.min(hits.length - 1, n + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((n) => Math.max(0, n - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); choose(hits[active]); }
            else if (e.key === "Escape" && q) { e.stopPropagation(); setQ(""); }
          }}
        />
      </label>
      {q.trim().length >= 2 ? (
        hits.length === 0 ? <p className="rs-help" role="status">{fmt(copy.search.none, { q: q.trim() })}</p> : (
          <ul id={listId} role="listbox" className="im-hits" aria-label={copy.search.label}>
            {hits.map((h, i) => (
              <li key={`${h.layer}:${h.id}`} id={`im-hit-${i}`} role="option" aria-selected={i === active}>
                <button type="button" className="im-item" data-active={i === active} onClick={() => choose(h)}>
                  <span>{h.title}</span><small>{copy.layers[h.layer]}</small>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : <p className="rs-help">{copy.search.hint}</p>}
    </div>
  );
}

export function OverlapChooser({ candidates, at, copy, onPick, onClose }: { candidates: Candidate[]; at: { x: number; y: number }; copy: InframapCopy; onPick: (c: Candidate) => void; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  return (
    <div className="im-chooser" role="dialog" aria-label={copy.more.chooser} style={{ left: Math.max(8, at.x), top: Math.max(8, at.y) }}>
      <div className="im-chooser-top"><strong>{copy.more.chooser}</strong><button type="button" className="im-x" aria-label={copy.more.close} onClick={onClose}><XIcon aria-hidden="true" /></button></div>
      <p className="rs-help">{copy.more.chooserHelp}</p>
      <ul>
        {candidates.slice(0, 12).map((c, i) => (
          <li key={`${c.layer}:${c.id}`}><button ref={i === 0 ? first : undefined} type="button" className="im-item" onClick={() => onPick(c)}><span>{c.title}</span><small>{copy.layers[c.layer]}</small></button></li>
        ))}
      </ul>
    </div>
  );
}

export function HoverCard({ layer, feature, at, copy, locale }: { layer: LayerKey; feature: MapFeature; at: { x: number; y: number }; copy: InframapCopy; locale: Locale }) {
  const info = summarize(layer, feature.properties);
  if (!info) return null;
  const p = feature.properties;
  const statusText = layer === "conflicts" ? str(p.band) ? valueLabel("conflicts", str(p.band) as string, copy, locale) : null : info.status ? valueLabel(layer, p.isOverdue === true ? "overdue" : info.status, copy, locale) : null;
  return (
    <div className="im-hover" style={{ left: at.x + 14, top: at.y + 14 }} role="presentation">
      <strong>{info.title}</strong>
      <span>{[statusText, str(p.agencyName)].filter(Boolean).join(" · ")}</span>
    </div>
  );
}

export type EvidenceState = { status: "idle" | "loading" | "error" | "ready"; data: ConflictEvidence | null };

export function QuickView({ layer, feature, evidence, copy, onClose }: { layer: LayerKey; feature: MapFeature; evidence: EvidenceState; copy: InframapCopy; onClose: () => void }) {
  const [locale] = useWorkspaceLocale();
  const p = feature.properties;
  const info = summarize(layer, p);
  const work = getWorkRequestCopy(locale).list;
  const f = copy.fields;
  const rows: [string, string | null][] = [];
  let chip: React.ReactNode = null;
  let extra: React.ReactNode = null;
  if (layer === "projects") {
    chip = <StatusChip domain="project" status={str(p.status) ?? "DRAFT"} label={valueLabel("projects", str(p.status) ?? "", copy, locale)} />;
    rows.push([f.code, str(p.projectCode)], [f.type, str(p.projectType)?.replace(/_/g, " ").toLowerCase() ?? null], [f.agency, str(p.agencyName)], [f.district, [str(p.district), str(p.province)].filter(Boolean).join(", ") || null], [f.dates, range(locale, p.startDate, p.plannedEndDate)]);
  } else if (layer === "roadworks") {
    const late = p.isOverdue === true;
    chip = <>
      <StatusChip domain="work" status={str(p.status) ?? "DRAFT"} label={work.statuses[str(p.status) ?? ""]} />
      {late ? <span className="im-overdue" title={copy.roadwork.overdueNote}>{copy.roadwork.overdue}</span> : null}
    </>;
    rows.push([f.workType, work.workTypes[str(p.workType) ?? ""] ?? null], [f.project, [str(p.projectCode), str(p.projectTitle)].filter(Boolean).join(" · ") || null], [f.agency, str(p.agencyName)], [f.priority, work.priorities[str(p.priority) ?? ""] ?? null], [f.dates, range(locale, p.plannedStart, p.plannedEnd)]);
    if (late) extra = <p className="rs-help">{copy.roadwork.overdueNote}</p>;
  } else {
    const conflict = getConflictCopy(locale);
    const band = str(p.band) as Band | null;
    const closed = (CLOSED_CONFLICT_STATUSES as readonly string[]).includes(str(p.status) ?? "");
    chip = <span className="rs-nb-chip">{conflict.status[str(p.status) ?? ""] ?? str(p.status)}</span>;
    rows.push([f.band, band ? getAssessmentCopy(locale).bands[band] : null], [f.score, typeof p.score === "number" ? String(p.score) : null], [f.district, str(p.district)], [f.resolution, str(p.resolutionState) ? (getResolutionCopy(locale).status[str(p.resolutionState) as string] ?? str(p.resolutionState)) : null], [f.window, range(locale, p.overlapStart, p.overlapEnd)]);
    const parties = (evidence.data?.features ?? []).filter((x) => x.properties.feature === "party");
    extra = (
      <div className="im-parties" aria-live="polite">
        <p className="im-legend-h">{copy.conflict.parties}</p>
        {evidence.status === "loading" ? <p className="rs-help">{copy.conflict.loadingEvidence}</p> : null}
        {evidence.status === "error" ? <p className="rs-help" role="alert">{copy.conflict.evidenceError}</p> : null}
        {evidence.status === "ready" && parties.length === 0 ? <p className="rs-help">{copy.conflict.noGeometry}</p> : null}
        {parties.map((x) => {
          const side = x.properties.side === "b" ? "b" : "a";
          return (
            <div key={side} className="im-party" data-side={side}>
              <i className="im-sw" data-shape={side === "a" ? "line" : "dash"} style={{ ["--c" as string]: side === "a" ? "#0369a1" : "#a21caf" }} aria-hidden="true" />
              <div><strong>{side === "a" ? copy.conflict.sideA : copy.conflict.sideB}</strong><span>{[str(x.properties.title), str(x.properties.agencyName)].filter(Boolean).join(" · ") || copy.noValue}</span></div>
            </div>
          );
        })}
        <p className="rs-help">{closed ? copy.conflict.closedNote : copy.conflict.openNote}</p>
      </div>
    );
  }
  return (
    <section className="im-details" aria-label={info?.title}>
      <div className="im-details-top"><strong>{info?.title}</strong><button type="button" className="im-x" aria-label={copy.more.close} onClick={onClose}><XIcon aria-hidden="true" /></button></div>
      <div className="im-chips">{chip}</div>
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? copy.noValue}</dd></div>)}</dl>
      {extra}
      <div className="im-details-actions">
        {info ? <Link className="rs-btn is-primary" href={info.href}><ExternalLinkIcon aria-hidden="true" />{copy.panel.open[layer]}</Link> : null}
        <button type="button" className="rs-btn" onClick={onClose}>{copy.panel.clear}</button>
      </div>
    </section>
  );
}
