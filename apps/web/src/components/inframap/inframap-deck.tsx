"use client";

import { useState } from "react";
import { ChevronDownIcon, EyeIcon, LockIcon, RefreshCwIcon, TargetIcon } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import type { Filters, LayerData, LayerKey } from "@/lib/inframap/inframap";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";
import { LAYER_DEFS, LAYER_GROUPS } from "@/lib/inframap/layer-registry";
import { CONDITION_COLOR, CONDITIONS_FOR_SPRITES } from "@/lib/inframap/map-icons";
import { fmt } from "@/lib/roadsync/assessment";

import { LegendShape } from "./inframap-parts";
import { valueLabel } from "./inframap-labels";

type Locale = "en" | "si" | "ta";
export type LayerQuery = { data: LayerData | undefined; isFetching: boolean; isError: boolean; error: unknown; refetch: () => unknown };

type Props = {
  copy: InframapCopy; locale: Locale; queries: Record<LayerKey, LayerQuery>; visible: Record<LayerKey, boolean>; available: Record<LayerKey, boolean>; ready: boolean;
  reasons: Record<LayerKey, "forbidden" | "unavailable" | undefined>; filters: Filters; hasBbox: boolean; focus: LayerKey | null; attention: boolean;
  onToggle: (k: LayerKey) => void; onGroup: (ids: LayerKey[], on: boolean) => void; onFilter: (layer: LayerKey, key: string, value: string) => void; onClearLayer: (k: LayerKey) => void;
  onFocus: (k: LayerKey) => void; onAttention: () => void;
};

/** Grouped "layer deck": generated from the registry, so a new layer appears here by adding a definition. */
export function LayerDeck(p: Props) {
  const { copy, locale } = p;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <div className="im-deck">
      {LAYER_GROUPS.map((g) => {
        const defs = LAYER_DEFS.filter((d) => d.group === g);
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
                  const status = q.error instanceof ApiError ? q.error.status : 0;
                  const on = p.visible[k] && !locked;
                  const features = q.data?.features.length ?? 0;
                  const loading = on && p.hasBbox && q.data === undefined && !q.isError;
                  const f = p.filters[k];
                  return (
                    <li key={k} className="im-layer" data-locked={locked} data-on={on} data-loading={loading} data-focus={p.focus === k}>
                      <div className="im-layer-row">
                        <button type="button" role="switch" aria-checked={on} disabled={locked} title={locked ? copy.more.locked : copy.layerHelp[k]} className="im-switch" onClick={() => p.onToggle(k)}>
                          {locked ? <LockIcon aria-hidden="true" /> : <LegendShape entry={def.legend[0]!} />}
                          <span>{copy.layers[k]}</span>
                          {on && q.data ? <small className="im-count">{features}</small> : null}
                        </button>
                        {on ? <button type="button" className="im-focus" aria-pressed={p.focus === k} aria-label={`${copy.deck.focus}: ${copy.layers[k]}`} title={p.focus === k ? copy.deck.exitFocus : copy.deck.focus} onClick={() => p.onFocus(k)}><TargetIcon aria-hidden="true" /></button> : null}
                      </div>
                      {loading ? <div className="im-shimmer" role="status" aria-label={fmt(copy.deck.loadingLayer, { layer: copy.layers[k] })} /> : null}
                      {locked ? <p className="im-layer-note"><LockIcon aria-hidden="true" />{p.reasons[k] === "unavailable" ? copy.more.unavailable : copy.more.locked}</p> : null}
                      {on && q.isError ? (
                        <p className="im-layer-note" role="alert">{status === 403 ? copy.more.locked : copy.states.error}{status !== 403 ? <button type="button" className="rs-btn" onClick={() => void q.refetch()}><RefreshCwIcon aria-hidden="true" />{copy.controls.retry}</button> : null}</p>
                      ) : null}
                      {on && (q.data?.restrictedHidden ?? 0) > 0 ? <p className="im-layer-note"><LockIcon aria-hidden="true" />{fmt(copy.deck.restrictedHidden, { n: q.data!.restrictedHidden })}</p> : null}
                      {on && k === "assets" ? <AssetsLens copy={copy} locale={locale} data={q.data} attention={p.attention} onAttention={p.onAttention} onCondition={(c) => p.onFilter("assets", "condition", c)} active={f.condition} /> : null}
                      {on ? (
                        <div className="im-chip-groups">
                          {def.filters.map((fd) => (
                            <div key={fd.key} role="group" aria-label={fmt(copy.filters.group, { layer: copy.layers[k] })} className="im-chipset">
                              {fd.values.map((v) => <button key={v} type="button" className="im-chip" aria-pressed={f[fd.key] === v} onClick={() => p.onFilter(k, fd.key, v)}>{valueLabel(k, v, copy, locale)}</button>)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {on && q.data !== undefined && !q.isFetching && !q.isError && features === 0 ? (
                        <p className="im-layer-note" role="status">{fmt(copy.more.emptyLayer, { layer: copy.layers[k].toLowerCase() })}{Object.values(f).some(Boolean) ? <button type="button" className="rs-btn" onClick={() => p.onClearLayer(k)}>{copy.filters.clearFilters}</button> : null}</p>
                      ) : null}
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

/** Needs-Attention toggle with a live counter, and a stacked condition bar whose segments apply the condition filter. */
function AssetsLens({ copy, locale, data, attention, onAttention, onCondition, active }: { copy: InframapCopy; locale: Locale; data: LayerData | undefined; attention: boolean; onAttention: () => void; onCondition: (c: string) => void; active: string | undefined }) {
  const features = data?.features ?? [];
  const needs = features.filter((f) => f.properties.needsAttention === true).length;
  const counts = CONDITIONS_FOR_SPRITES.map((c) => [c, features.filter((f) => f.properties.condition === c).length] as const).filter(([, n]) => n > 0);
  return (
    <div className="im-lens-box">
      <button type="button" className="rs-btn im-attn" role="switch" aria-checked={attention} onClick={onAttention}>{copy.deck.attention}<small className="im-count">{needs}</small></button>
      {counts.length > 0 ? (
        <div className="im-condbar" role="group" aria-label={copy.deck.conditionBar}>
          {counts.map(([c, n]) => (
            <button key={c} type="button" className="im-condseg" aria-pressed={active === c} style={{ flexGrow: n, background: CONDITION_COLOR[c] }} title={`${valueLabel("assets", c, copy, locale)}: ${n}`} aria-label={`${valueLabel("assets", c, copy, locale)}: ${n}`} onClick={() => onCondition(c)}><span>{n}</span></button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
