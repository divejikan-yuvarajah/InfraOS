"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type MutableRefObject } from "react";
import { PrinterIcon } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { activeFilters, type UF } from "@/lib/inframap/filters-state";
import { fetchFacets, type Count, type FacetsData } from "@/lib/inframap/inframap-api";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";
import type { B3Copy } from "@/lib/inframap/inframap-copy-b3";
import { LAYER_KEYS, type Bbox, type LayerData, type LayerKey } from "@/lib/inframap/inframap";
import { placeName } from "@/lib/inframap/places-copy";
import { fmt } from "@/lib/roadsync/assessment";
import type { CaptureFn } from "./inframap-map";
import { valueLabel } from "./inframap-labels";

type Locale = "en" | "si" | "ta";
const sum = (c: Count[] | undefined) => (c ? c.reduce((n, x) => n + x.count, 0) : null);

/** Exact per-layer counts under the current filters and viewport, from /facets (same scope rules as the layers). */
function exactCounts(f: FacetsData | undefined): Partial<Record<LayerKey, number | null>> {
  if (!f) return {};
  return { projects: sum(f.projects?.projectStatus), roadworks: sum(f.roadworks?.roadworkStatus), conflicts: sum(f.conflicts?.conflictBand), assets: sum(f.assets?.assetType), utilities: sum(f.utilities?.utilityClass), risks: sum(f.risks?.hazardType) };
}

/**
 * Printable, authorization-safe summary of the current view. Everything here comes from responses the viewer was already
 * allowed to load (plus /facets for exact counts); nothing is fetched with extra rights. Print uses the browser's own
 * print dialog and a print stylesheet that hides the rest of the page.
 */
function BriefBody({ onOpenChange, copy, c3, locale, data, shown, uf, viewport, scopeLabel, roleLabel, captureRef, userKey, queryKey }: {
  onOpenChange: (o: boolean) => void; copy: InframapCopy; c3: B3Copy; locale: Locale; data: Partial<Record<LayerKey, LayerData>>; shown: Record<LayerKey, boolean>;
  uf: UF; viewport: Bbox | null; scopeLabel: string; roleLabel: string; captureRef: MutableRefObject<CaptureFn | null>; userKey: string; queryKey: readonly unknown[];
}) {
  // The dialog content only exists while open, so this state starts fresh on every open.
  const [image, setImage] = useState<string | null | undefined>(undefined);
  const [generated] = useState(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date()));
  useEffect(() => {
    let alive = true;
    void (captureRef.current ? captureRef.current() : Promise.resolve(null)).then((url) => { if (alive) setImage(url); });
    return () => { alive = false; };
  }, [captureRef]);
  const facets = useQuery({ queryKey: [...queryKey, "brief", userKey], queryFn: ({ signal }) => fetchFacets(viewport, uf, signal), enabled: Boolean(userKey), staleTime: 10_000, retry: false });
  const exact = exactCounts(facets.data);
  const conflicts = [...(data.conflicts?.features ?? [])].sort((a, b) => Number(b.properties.score ?? 0) - Number(a.properties.score ?? 0)).slice(0, 5);
  const needing = (data.assets?.features ?? []).filter((f) => f.properties.needsAttention === true).slice(0, 8);
  const zones = (data.risks?.features ?? []).filter((f) => f.properties.kind === "hazard").slice(0, 8);
  const markers = (data.risks?.features ?? []).filter((f) => f.properties.kind === "project");
  const anyDemo = LAYER_KEYS.some((k) => shown[k] && data[k]?.features.some((f) => f.properties.isDemo === true));
  const filters = activeFilters(uf);
  const label = (f: { key: keyof UF; value: string }) => `${c3.fp.keys[f.key] ?? f.key}: ${f.key === "province" || f.key === "district" ? placeName(f.value, locale) : f.key === "agencyId" ? f.value.slice(-6) : (c3.fp.flags[f.value] && ["overdue", "attention", "conflictStatusGroup"].includes(f.key)) ? c3.fp.flags[f.value] : valueLabel("projects", f.value, copy, locale)}`;
  const b = c3.brief;
  return (
    <>
        <DialogTitle>{b.title}</DialogTitle>
        <DialogDescription id="im-brief-sub">{b.subtitle}</DialogDescription>
        <div className="im-brief-body">
          <p className="rs-help">{fmt(b.generated, { time: generated, role: roleLabel, scope: scopeLabel })}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image ? <figure><img src={image} alt={b.snapshot} className="im-brief-map" /><figcaption className="rs-help">{b.snapshot}</figcaption></figure> : image === null ? <p className="rs-help">{b.snapshotFailed}</p> : <p className="rs-help">{b.loading}</p>}
          <h3 className="im-h">{b.counts}</h3>
          <ul className="im-brief-counts">{LAYER_KEYS.filter((k) => shown[k]).map((k) => (
            <li key={k}><span>{copy.layers[k]}</span><b>{data[k]?.features.length ?? 0}{exact[k] != null ? ` / ${exact[k]}` : ""}</b></li>
          ))}</ul>
          <h3 className="im-h">{b.topConflicts}</h3>
          {conflicts.length ? <ol>{conflicts.map((f) => <li key={String(f.properties.id)}>{String(f.properties.conflictNo)} · {valueLabel("conflicts", String(f.properties.band ?? ""), copy, locale)} · {String(f.properties.score ?? "–")}</li>)}</ol> : <p className="rs-help">{b.none}</p>}
          <h3 className="im-h">{b.attention}</h3>
          {needing.length ? <ul>{needing.map((f) => <li key={String(f.properties.id)}>{String(f.properties.name)} · {valueLabel("assets", String(f.properties.condition ?? "UNKNOWN"), copy, locale)}</li>)}</ul> : <p className="rs-help">{b.none}</p>}
          <h3 className="im-h">{b.exposure}</h3>
          {zones.length || markers.length ? <ul>{zones.map((f) => <li key={String(f.properties.id)}>{String(f.properties.name)} · {valueLabel("risks", String(f.properties.level), copy, locale)}</li>)}{markers.length ? <li>{copy.layers.risks}: {markers.length}</li> : null}</ul> : <p className="rs-help">{b.exposureNone}</p>}
          <h3 className="im-h">{b.filters}</h3>
          {filters.length ? <ul>{filters.map((f) => <li key={`${f.key}${f.value}`}>{label(f)}</li>)}</ul> : <p className="rs-help">{b.noFilters}</p>}
          <h3 className="im-h">{b.sources}</h3>
          <p className="rs-help">{anyDemo ? b.demo : b.live} {b.disclaimer}</p>
        </div>
        <div className="im-details-actions im-noprint">
          <button type="button" className="rs-btn is-primary" onClick={() => window.print()}><PrinterIcon aria-hidden="true" />{b.print}</button>
          <button type="button" className="rs-btn" onClick={() => onOpenChange(false)}>{b.close}</button>
        </div>
    </>
  );
}

type BriefProps = Parameters<typeof BriefBody>[0] & { open: boolean };
/** Printable summary of the current view. The body mounts only while open, so each open captures a fresh snapshot. */
export default function MapBrief({ open, onOpenChange, ...rest }: BriefProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="im-brief" aria-describedby="im-brief-sub">
        <BriefBody onOpenChange={onOpenChange} {...rest} />
      </DialogContent>
    </Dialog>
  );
}
