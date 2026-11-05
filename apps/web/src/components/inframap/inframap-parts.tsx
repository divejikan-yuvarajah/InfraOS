"use client";

import { useEffect, useRef } from "react";
import { XIcon } from "lucide-react";

import { summarize, type LayerKey, type MapFeature } from "@/lib/inframap/inframap";
import type { ConflictEvidence } from "@/lib/inframap/inframap-api";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";
import { LAYER_DEFS, LAYER_GROUPS, type LegendEntry } from "@/lib/inframap/layer-registry";
import type { Candidate } from "@/lib/inframap/selection-priority";

import { SpriteSwatch } from "./inframap-context-panels";
import { valueLabel } from "./inframap-labels";

type Locale = "en" | "si" | "ta";
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

export function LegendShape({ entry }: { entry: LegendEntry }) {
  if (entry.sprite) return <SpriteSwatch sprite={entry.sprite} />;
  return <i className="im-sw" data-shape={entry.shape} style={{ ["--c" as string]: entry.color }} aria-hidden="true" />;
}

export function Legend({ copy, locale, visible }: { copy: InframapCopy; locale: Locale; visible: Record<LayerKey, boolean> }) {
  return (
    <details className="im-legend">
      <summary>{copy.controls.legend}</summary>
      {LAYER_GROUPS.map((g) => {
        const defs = LAYER_DEFS.filter((d) => d.group === g && visible[d.id]);
        return defs.length === 0 ? null : (
          <div key={g}>
            <p className="im-legend-group">{copy.groups[g]}</p>
            {defs.map((d) => (
              <div key={d.id}>
                <p className="im-legend-h">{copy.layers[d.id]}</p>
                <ul>{d.legend.map((e) => <li key={e.id}><LegendShape entry={e} />{valueLabel(d.id, e.id, copy, locale)}</li>)}</ul>
              </div>
            ))}
          </div>
        );
      })}
      <p className="rs-help">{copy.more.layersLegendNote}</p>
    </details>
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
