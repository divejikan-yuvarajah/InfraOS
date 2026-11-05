"use client";

import { useState } from "react";
import { ArrowDownToLineIcon, ArrowUpToLineIcon, ChevronDownIcon, EyeIcon, LockIcon, RefreshCwIcon, TargetIcon } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { UF } from "@/lib/inframap/filters-state";
import type { LayerData, LayerKey } from "@/lib/inframap/inframap";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";
import type { B3Copy } from "@/lib/inframap/inframap-copy-b3";
import { LAYER_DEFS, LAYER_GROUPS } from "@/lib/inframap/layer-registry";
import { CONDITION_COLOR, CONDITIONS_FOR_SPRITES } from "@/lib/inframap/map-icons";
import { fmt } from "@/lib/roadsync/assessment";

import { valueLabel } from "./inframap-labels";
import { LegendShape } from "./inframap-parts";

type Locale = "en" | "si" | "ta";
export type LayerQuery = { data: LayerData | undefined; isFetching: boolean; isError: boolean; error: unknown; refetch: () => unknown };
export type LayerPreset = "operations" | "infrastructure" | "risk" | "all";

type Props = {
  copy: InframapCopy; c3: B3Copy; locale: Locale; queries: Record<LayerKey, LayerQuery>; visible: Record<LayerKey, boolean>; available: Record<LayerKey, boolean>; ready: boolean;
  reasons: Record<LayerKey, "forbidden" | "unavailable" | undefined>; uf: UF; hasBbox: boolean; focus: LayerKey | null; attention: boolean;
  opacity: Record<LayerKey, number>; order: readonly LayerKey[];
  onToggle: (k: LayerKey) => void; onGroup: (ids: LayerKey[], on: boolean) => void; onFocus: (k: LayerKey) => void; onAttention: () => void; onCondition: (c: string) => void;
  onOpacity: (k: LayerKey, v: number) => void; onMove: (k: LayerKey, to: "front" | "back") => void; onShowOnly: (k: LayerKey) => void; onPreset: (p: LayerPreset) => void; onResetLayers: () => void;
};

/** Layer manager: grouped layers generated from the registry, with opacity, ordering, presets and per-layer state. */
export function LayerDeck(p: Props) {
  const { copy, c3, locale } = p;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <div className="im-deck">
      <div className="im-presets" role="group" aria-label={c3.lm.presets}>
        {(["operations", "infrastructure", "risk", "all"] as const).map((k) => <button key={k} type="button" className="im-chip" onClick={() => p.onPreset(k)}>{c3.lm.presetNames[k]}</button>)}
        <button type="button" className="im-chip" onClick={p.onResetLayers}>{c3.lm.reset}</button>
      </div>
      {LAYER_GROUPS.map((g) => {
        const defs = LAYER_DEFS.filter((d) => d.group === g).sort((a, b) => p.order.indexOf(a.id) - p.order.indexOf(b.id));
        if (defs.length === 0) return null;
        const usable = defs.filter((d) => p.available[d.id]);
        const allOn = usable.length > 0 && usable.every((d) => p.visible[d.id]);
        return (
          <section key={g} className="im-group" aria-label={copy.groups[g]}>
            <div className="im-group-head">
              <button type="button" className="im-group-toggle" aria-expanded={!collapsed[g]} onClick={() => setCollapsed((c) => ({ ...c, [g]: !c[g] }))}>
                <ChevronDownIcon aria-hidden="true" data-collapsed={Boolean(collapsed[g])} /><span>{copy.groups[g]}</span>
              </button>
              <button type="button" role="switch" aria-checked={allOn} disabled={usable.length === 0} className="im-master" aria-label={fmt(copy.deck.groupOn, { group: copy.groups[g] })} title={fmt(copy.deck.groupOn, { group: copy.groups[g] })} onClick={() => p.onGroup(usable.map((d) => d.id), !allOn)}><EyeIcon aria-hidden="true" /></button>
            </div>
            {collapsed[g] ? null : (
              <ul className="im-layers">
                {defs.map((def) => {
                  const k = def.id;
                  const q = p.queries[k];
                  const locked = p.ready && !p.available[k];
                  const status = q?.error instanceof ApiError ? q.error.status : 0;
                  const on = p.visible[k] && !locked;
                  const features = q?.data?.features.length ?? 0;
                  const total = q?.data?.total;
                  const loading = on && p.hasBbox && q?.data === undefined && !q?.isError;
                  const peers = defs.filter((d) => d.id !== "conflicts");
                  const movable = k !== "conflicts" && peers.length > 1;
                  const pct = Math.round((p.opacity[k] ?? 1) * 100);
                  const state = locked ? "locked" : q?.isError && on ? "error" : loading ? "loading" : "available";
                  return (
                    <li key={k} className="im-layer" data-locked={locked} data-on={on} data-loading={loading} data-focus={p.focus === k}>
                      <div className="im-layer-row">
                        <button type="button" role="switch" aria-checked={on} disabled={locked} title={locked ? copy.more.locked : copy.layerHelp[k]} className="im-switch" onClick={() => p.onToggle(k)}>
                          {locked ? <LockIcon aria-hidden="true" /> : <LegendShape entry={def.legend[0]!} />}
                          <span>{copy.layers[k]}</span>
                          {on && q?.data ? <small className="im-count" title={total !== undefined && q.data.truncated ? fmt(c3.lm.showing, { n: features, total }) : undefined}>{features}{total !== undefined && q.data.truncated ? `/${total}` : ""}</small> : null}
                        </button>
                        {on ? <button type="button" className="im-focus" aria-pressed={p.focus === k} aria-label={`${copy.deck.focus}: ${copy.layers[k]}`} title={p.focus === k ? copy.deck.exitFocus : copy.deck.focus} onClick={() => p.onFocus(k)}><TargetIcon aria-hidden="true" /></button> : null}
                      </div>
                      <span className="sr-only">{c3.lm.status[state]}</span>
                      {loading ? <div className="im-shimmer" role="status" aria-label={fmt(copy.deck.loadingLayer, { layer: copy.layers[k] })} /> : null}
                      {locked ? <p className="im-layer-note"><LockIcon aria-hidden="true" />{p.reasons[k] === "unavailable" ? copy.more.unavailable : copy.more.locked}</p> : null}
                      {on && q?.isError ? (
                        <p className="im-layer-note" role="alert">{status === 403 ? copy.more.locked : copy.states.error}{status !== 403 ? <button type="button" className="rs-btn" onClick={() => void q.refetch()}><RefreshCwIcon aria-hidden="true" />{copy.controls.retry}</button> : null}</p>
                      ) : null}
                      {on && (q?.data?.restrictedHidden ?? 0) > 0 ? <p className="im-layer-note"><LockIcon aria-hidden="true" />{fmt(copy.deck.restrictedHidden, { n: q!.data!.restrictedHidden })}</p> : null}
                      {on && q?.data?.truncated ? <p className="im-layer-note im-warn">{total !== undefined ? fmt(copy.more.truncatedBar, { n: features, layer: copy.layers[k].toLowerCase() }).replace(String(features), `${features} / ${total}`) : fmt(copy.more.truncatedBar, { n: features, layer: copy.layers[k].toLowerCase() })}</p> : null}
                      {on ? (
                        <div className="im-lm">
                          <label className="im-opacity">
                            <span className="sr-only">{fmt(c3.lm.opacity, { layer: copy.layers[k] })}</span>
                            <input type="range" min={0} max={100} step={5} value={pct} aria-label={fmt(c3.lm.opacity, { layer: copy.layers[k] })} aria-valuetext={fmt(c3.lm.opacityValue, { n: pct })} onChange={(e) => p.onOpacity(k, Number(e.target.value) / 100)} />
                            <output>{fmt(c3.lm.opacityValue, { n: pct })}</output>
                          </label>
                          <div className="im-lm-btns">
                            {movable ? <button type="button" className="im-focus" aria-label={`${c3.lm.front}: ${copy.layers[k]}`} title={c3.lm.front} onClick={() => p.onMove(k, "front")}><ArrowUpToLineIcon aria-hidden="true" /></button> : null}
                            {movable ? <button type="button" className="im-focus" aria-label={`${c3.lm.back}: ${copy.layers[k]}`} title={c3.lm.back} onClick={() => p.onMove(k, "back")}><ArrowDownToLineIcon aria-hidden="true" /></button> : null}
                            <button type="button" className="im-chip" onClick={() => p.onShowOnly(k)}>{c3.lm.showOnly}</button>
                          </div>
                        </div>
                      ) : null}
                      {on && k === "assets" ? <AssetsLens copy={copy} locale={locale} data={q?.data} attention={p.attention} onAttention={p.onAttention} onCondition={p.onCondition} active={p.uf.condition} /> : null}
                      {on && q?.data !== undefined && !q.isFetching && !q.isError && features === 0 ? <p className="im-layer-note" role="status">{fmt(copy.more.emptyLayer, { layer: copy.layers[k].toLowerCase() })}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Needs-Attention toggle with a live counter, and a stacked condition bar whose segments toggle the condition filter. */
function AssetsLens({ copy, locale, data, attention, onAttention, onCondition, active }: { copy: InframapCopy; locale: Locale; data: LayerData | undefined; attention: boolean; onAttention: () => void; onCondition: (c: string) => void; active: string[] }) {
  const features = data?.features ?? [];
  const needs = features.filter((f) => f.properties.needsAttention === true).length;
  const counts = CONDITIONS_FOR_SPRITES.map((c) => [c, features.filter((f) => f.properties.condition === c).length] as const).filter(([, n]) => n > 0);
  return (
    <div className="im-lens-box">
      <button type="button" className="rs-btn im-attn" role="switch" aria-checked={attention} onClick={onAttention}>{copy.deck.attention}<small className="im-count">{needs}</small></button>
      {counts.length > 0 ? (
        <div className="im-condbar" role="group" aria-label={copy.deck.conditionBar}>
          {counts.map(([c, n]) => (
            <button key={c} type="button" className="im-condseg" aria-pressed={active.includes(c)} style={{ flexGrow: n, background: CONDITION_COLOR[c] }} title={`${valueLabel("assets", c, copy, locale)}: ${n}`} aria-label={`${valueLabel("assets", c, copy, locale)}: ${n}`} onClick={() => onCondition(c)}><span>{n}</span></button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
