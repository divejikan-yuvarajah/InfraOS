"use client";

import { useMemo, useState } from "react";
import { XIcon } from "lucide-react";

import { activeFilters, applyPreset, datePreset, FILTER_PRESETS, removeFilter, toggleValue, type ActiveFilter, type ListKey, type UF } from "@/lib/inframap/filters-state";
import { districtsOf, OPTIONS, PROVINCE_NAMES } from "@/lib/inframap/filter-options";
import type { Count, FacetsData } from "@/lib/inframap/inframap-api";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";
import type { B3Copy } from "@/lib/inframap/inframap-copy-b3";
import { LAYER_DEFS } from "@/lib/inframap/layer-registry";
import type { LayerKey } from "@/lib/inframap/inframap";
import { placeName } from "@/lib/inframap/places-copy";
import { fmt } from "@/lib/roadsync/assessment";

import { valueLabel } from "./inframap-labels";

type Locale = "en" | "si" | "ta";
const countOf = (counts: Count[] | undefined, value: string): number | null => (counts ? counts.find((c) => c.value === value)?.count ?? 0 : null);

function Chips({ field, options, counts, uf, setUf, layer, copy, c3, locale }: {
  field: ListKey; options: readonly string[]; counts: Count[] | undefined; uf: UF; setUf: (u: UF) => void; layer: LayerKey | "global"; copy: InframapCopy; c3: B3Copy; locale: Locale;
}) {
  const text = (v: string) => (field === "province" || field === "district" ? placeName(v, locale) : valueLabel(layer === "global" ? "projects" : layer, v, copy, locale));
  return (
    <div role="group" aria-label={c3.fp.keys[field]} className="im-chipset">
      {options.map((v) => {
        const n = countOf(counts, v);
        const on = uf[field].includes(v);
        // Zero-count options stay visible but disabled; a selected one can always be deselected.
        return <button key={v} type="button" className="im-chip" aria-pressed={on} disabled={n === 0 && !on} onClick={() => setUf(toggleValue(uf, field, v))}>{text(v)}{n !== null ? <small className="im-chip-n">{n}</small> : null}</button>;
      })}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-checked={on} className="im-chip" onClick={onChange}>{label}</button>;
}

/** Advanced filters. Counts come from /facets (each facet excludes its own filter); every control changes server-side results. */
export function FilterPanel({ uf, setUf, facets, available, copy, c3, locale, onPresetLayers }: {
  uf: UF; setUf: (u: UF) => void; facets: FacetsData | undefined; available: Record<LayerKey, boolean>; copy: InframapCopy; c3: B3Copy; locale: Locale; onPresetLayers: (layers: readonly LayerKey[]) => void;
}) {
  const f = c3.fp;
  const [agencyQuery, setAgencyQuery] = useState("");
  const agencies = useMemo(() => (facets?.global.agencies ?? []).filter((a) => a.label.toLowerCase().includes(agencyQuery.trim().toLowerCase())), [facets, agencyQuery]);
  const selectedAgencies = facets?.global.agencies.filter((a) => uf.agencyId.includes(a.value)) ?? [];
  const districts = districtsOf(uf.province);
  const today = new Date();
  const setDates = (d: { dateFrom: string; dateTo: string }) => setUf({ ...uf, ...d });
  const layerOn = (l: LayerKey) => available[l];
  const section = (id: LayerKey, children: React.ReactNode) => (layerOn(id) ? <section key={id} className="im-fsec"><h3 className="im-h">{copy.layers[id]}</h3>{children}</section> : null);
  const chips = (field: ListKey, options: readonly string[], counts: Count[] | undefined, layer: LayerKey) => <Chips field={field} options={options} counts={counts} uf={uf} setUf={setUf} layer={layer} copy={copy} c3={c3} locale={locale} />;

  return (
    <div className="im-filters">
      <section className="im-fsec">
        <h3 className="im-h">{f.presets}</h3>
        <div className="im-chipset">
          {FILTER_PRESETS.map((p) => (
            <button key={p.id} type="button" className="im-chip" disabled={!p.layers.some(layerOn)} onClick={() => { setUf(applyPreset(uf, p)); onPresetLayers(p.layers.filter(layerOn)); }}>{f.presetNames[p.id]}</button>
          ))}
        </div>
      </section>

      <section className="im-fsec">
        <h3 className="im-h">{f.global}</h3>
        <label className="im-flabel" htmlFor="im-agency-search">{f.agency}</label>
        <input id="im-agency-search" className="im-input" type="search" placeholder={f.searchOptions} value={agencyQuery} onChange={(e) => setAgencyQuery(e.target.value)} />
        <div role="group" aria-label={f.agency} className="im-chipset im-chipset-scroll">
          {[...selectedAgencies.filter((a) => !agencies.includes(a)), ...agencies].map((a) => (
            <button key={a.value} type="button" className="im-chip" aria-pressed={uf.agencyId.includes(a.value)} onClick={() => setUf(toggleValue(uf, "agencyId", a.value))}>{a.label}<small className="im-chip-n">{a.count}</small></button>
          ))}
          {agencies.length === 0 ? <span className="rs-help">{f.noOptions}</span> : null}
        </div>
        <label className="im-flabel">{f.province}</label>
        <Chips field="province" options={PROVINCE_NAMES} counts={facets?.global.provinces} uf={uf} setUf={(next) => setUf({ ...next, district: next.district.filter((d) => districtsOf(next.province).includes(d)) })} layer="global" copy={copy} c3={c3} locale={locale} />
        <label className="im-flabel">{f.district}</label>
        <Chips field="district" options={districts} counts={facets?.global.districts} uf={uf} setUf={setUf} layer="global" copy={copy} c3={c3} locale={locale} />
        <label className="im-flabel">{f.dates}</label>
        <div className="im-chipset">
          <button type="button" className="im-chip" onClick={() => setDates(datePreset("thisMonth", today))}>{f.thisMonth}</button>
          <button type="button" className="im-chip" onClick={() => setDates(datePreset("next30", today))}>{f.next30}</button>
          <button type="button" className="im-chip" onClick={() => setDates(datePreset("next90", today))}>{f.next90}</button>
          {uf.dateFrom || uf.dateTo ? <button type="button" className="im-chip" onClick={() => setDates({ dateFrom: "", dateTo: "" })}>{f.clearDates}</button> : null}
        </div>
        <div className="im-dates" aria-label={f.custom}>
          <label>{f.from}<input type="date" className="im-input" value={uf.dateFrom} max={uf.dateTo || undefined} onChange={(e) => setUf({ ...uf, dateFrom: e.target.value })} /></label>
          <label>{f.to}<input type="date" className="im-input" value={uf.dateTo} min={uf.dateFrom || undefined} onChange={(e) => setUf({ ...uf, dateTo: e.target.value })} /></label>
        </div>
      </section>

      {section("projects", <>{chips("projectStatus", OPTIONS.projectStatus, facets?.projects?.projectStatus, "projects")}{chips("projectType", OPTIONS.projectType, facets?.projects?.projectType, "projects")}</>)}
      {section("roadworks", <>
        {chips("roadworkStatus", OPTIONS.roadworkStatus, facets?.roadworks?.roadworkStatus, "roadworks")}
        {chips("workType", OPTIONS.workType, facets?.roadworks?.workType, "roadworks")}
        <Toggle label={f.flags.overdue!} on={uf.overdue} onChange={() => setUf({ ...uf, overdue: !uf.overdue })} />
      </>)}
      {section("conflicts", <>
        {chips("conflictBand", OPTIONS.conflictBand, facets?.conflicts?.conflictBand, "conflicts")}
        <div className="im-seg" role="radiogroup" aria-label={f.keys.conflictStatusGroup}>
          {(["", "open", "resolved"] as const).map((g) => <button key={g || "all"} type="button" role="radio" aria-checked={uf.conflictStatusGroup === g} className="im-seg-btn" onClick={() => setUf({ ...uf, conflictStatusGroup: g })}>{g === "" ? f.flags.all : f.flags[g]}{g ? <small className="im-chip-n">{countOf(facets?.conflicts?.conflictStatusGroup, g) ?? ""}</small> : null}</button>)}
        </div>
      </>)}
      {section("assets", <>
        {chips("assetType", OPTIONS.assetType, facets?.assets?.assetType, "assets")}
        {chips("condition", OPTIONS.condition, facets?.assets?.condition, "assets")}
        <Toggle label={f.flags.attention!} on={uf.attention} onChange={() => setUf({ ...uf, attention: !uf.attention })} />
      </>)}
      {section("utilities", chips("utilityClass", OPTIONS.utilityClass, facets?.utilities?.utilityClass, "utilities"))}
      {section("risks", <>{chips("hazardType", OPTIONS.hazardType, facets?.risks?.hazardType, "risks")}{chips("hazardLevel", OPTIONS.hazardLevel, facets?.risks?.hazardLevel, "risks")}{chips("riskBand", OPTIONS.riskBand, undefined, "risks")}</>)}
      {LAYER_DEFS.every((d) => !layerOn(d.id)) ? <p className="rs-help">{f.unavailable}</p> : null}
      <p className="rs-help">{f.unmappedNote}</p>
    </div>
  );
}

/** Applied-filter chips above the map: each removable, "Clear all", announced politely. */
export function AppliedChips({ uf, setUf, copy, c3, locale, facets }: { uf: UF; setUf: (u: UF) => void; copy: InframapCopy; c3: B3Copy; locale: Locale; facets: FacetsData | undefined }) {
  const list = activeFilters(uf);
  if (list.length === 0) return null;
  const text = (a: ActiveFilter): string => {
    const k = a.key;
    const v = k === "province" || k === "district" ? placeName(a.value, locale)
      : k === "agencyId" ? facets?.global.agencies.find((x) => x.value === a.value)?.label ?? `…${a.value.slice(-6)}`
      : k === "dateFrom" || k === "dateTo" ? a.value
      : k === "overdue" ? c3.fp.flags.overdue! : k === "attention" ? c3.fp.flags.attention!
      : k === "conflictStatusGroup" ? c3.fp.flags[a.value]!
      : valueLabel(k.startsWith("roadwork") || k === "workType" ? "roadworks" : k.startsWith("conflict") ? "conflicts" : k === "assetType" || k === "condition" ? "assets" : k === "utilityClass" ? "utilities" : k.startsWith("hazard") || k === "riskBand" ? "risks" : "projects", a.value, copy, locale);
    return `${c3.fp.keys[k] ?? k}: ${v}`;
  };
  return (
    <div className="im-applied" role="group" aria-label={c3.fp.applied}>
      <span className="sr-only" aria-live="polite">{fmt(list.length === 1 ? c3.fp.badgeOne : c3.fp.badge, { n: list.length })}</span>
      {list.map((a) => (
        <button key={`${a.key}:${a.value}`} type="button" className="im-applied-chip" aria-label={fmt(c3.fp.remove, { label: text(a) })} onClick={() => setUf(removeFilter(uf, a))}>{text(a)}<XIcon aria-hidden="true" /></button>
      ))}
      <button type="button" className="im-link" onClick={() => setUf({ ...uf, ...Object.fromEntries(list.map((a) => [a.key, Array.isArray(uf[a.key]) ? [] : typeof uf[a.key] === "boolean" ? false : ""])) })}>{c3.fp.clearAll}</button>
    </div>
  );
}
