"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClockIcon, MapPinIcon, SearchIcon, XIcon } from "lucide-react";

import { parseCoordinates, type ParsedCoordinates } from "@/lib/inframap/coordinates";
import type { SearchData, SearchItem } from "@/lib/inframap/inframap-api";
import type { InframapCopy } from "@/lib/inframap/inframap-copy";
import type { B3Copy } from "@/lib/inframap/inframap-copy-b3";
import { loadRecent, pushRecent, saveRecent } from "@/lib/inframap/local-store";
import { placeName } from "@/lib/inframap/places-copy";
import { fmt } from "@/lib/roadsync/assessment";

import { valueLabel } from "./inframap-labels";

type Locale = "en" | "si" | "ta";
type Row = { kind: "item"; item: SearchItem } | { kind: "coords"; coords: ParsedCoordinates };

/** Bolds the matched part with plain string search (never a regex built from user text). */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/**
 * Universal GIS search. Matching happens on the server under the viewer's own scope, so what appears here is exactly what
 * the viewer may see. Debounced, aborts stale requests, keyboard navigable, with recent searches, a "This view / Everywhere"
 * scope, and coordinate input handled locally. Street-address geocoding is intentionally not included.
 */
export function SearchBox({ copy, c3, locale, scope, onScope, search, queryKey, onSelect, onCoordinates, inputId = "im-search", autoFocus = false, inputRef }: {
  copy: InframapCopy; c3: B3Copy; locale: Locale; scope: "view" | "all"; onScope: (s: "view" | "all") => void;
  search: (q: string, scope: "view" | "all", signal: AbortSignal) => Promise<SearchData>; queryKey: readonly unknown[];
  onSelect: (item: SearchItem, q: string, siblings: SearchItem[]) => void; onCoordinates: (c: ParsedCoordinates) => void; inputId?: string; autoFocus?: boolean; inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const s = c3.search;
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const local = useRef<HTMLInputElement>(null);
  const input = inputRef ?? local;
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim().replace(/\s+/g, " ")), 200); return () => clearTimeout(t); }, [q]);

  const coords = useMemo(() => parseCoordinates(q), [q]);
  const enabled = debounced.length >= 2 && !coords;
  const result = useQuery({ queryKey: [...queryKey, "search", debounced, scope], queryFn: ({ signal }) => search(debounced, scope, signal), enabled, staleTime: 15_000, retry: false, placeholderData: (prev) => prev });

  const rows: Row[] = useMemo(() => {
    if (coords) return [{ kind: "coords", coords }];
    if (!enabled) return [];
    return (result.data?.groups ?? []).flatMap((g) => g.items.map((item): Row => ({ kind: "item", item })));
  }, [coords, enabled, result.data]);
  const safeActive = Math.min(active, Math.max(0, rows.length - 1));
  const showPanel = focused && (rows.length > 0 || enabled || (q.trim() === "" && recent.length > 0));

  const choose = (row: Row | undefined) => {
    if (!row) return;
    if (row.kind === "coords") { if (row.coords.insideSriLanka) { onCoordinates(row.coords); setQ(""); } return; }
    const next = pushRecent(recent, q);
    setRecent(next); saveRecent(next);
    onSelect(row.item, debounced, rows.flatMap((r) => (r.kind === "item" && r.item.layer === row.item.layer ? [r.item] : [])));
    setQ("");
  };
  const label = (layer: string) => layer === "places" ? s.places : layer === "agencies" ? s.agencies : (copy.layers as Record<string, string>)[layer] ?? layer;
  const statusText = (i: SearchItem) => i.status ? valueLabel((i.layer in copy.layers ? i.layer : "projects") as never, i.status, copy, locale) : null;
  const title = (i: SearchItem) => (i.layer === "places" ? placeName(i.title, locale) : i.title);
  let index = -1;

  return (
    <div className="im-search" role="search">
      <div className="im-search-box">
        <SearchIcon aria-hidden="true" />
        <input
          ref={input} id={inputId} type="search" inputMode="search" enterKeyHint="search" autoFocus={autoFocus} value={q} placeholder={s.placeholder} aria-label={s.label} autoComplete="off" role="combobox"
          aria-expanded={showPanel} aria-controls={`${inputId}-list`} aria-activedescendant={rows.length ? `${inputId}-opt-${safeActive}` : undefined}
          onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(rows.length - 1, safeActive + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, safeActive - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); choose(rows[safeActive]); }
            else if (e.key === "Escape" && q) { e.stopPropagation(); setQ(""); }
          }}
        />
        {q ? <button type="button" className="im-x" aria-label={s.clear} onClick={() => { setQ(""); input.current?.focus(); }}><XIcon aria-hidden="true" /></button> : null}
      </div>
      <div className="im-seg" role="radiogroup" aria-label={s.scopeLabel}>
        {(["view", "all"] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={scope === v} className="im-seg-btn" onClick={() => onScope(v)}>{v === "view" ? s.scopeView : s.scopeAll}</button>)}
      </div>
      <div className="sr-only" aria-live="polite">{enabled && result.data ? fmt(s.count, { n: rows.length }) : ""}</div>
      {showPanel ? (
        <div className="im-search-panel" id={`${inputId}-list`} role="listbox" aria-label={s.results}>
          {q.trim() === "" && recent.length > 0 ? (
            <div>
              <p className="im-legend-h"><ClockIcon aria-hidden="true" /> {s.recent} <button type="button" className="im-link" onMouseDown={(e) => e.preventDefault()} onClick={() => { setRecent([]); saveRecent([]); }}>{s.clearRecent}</button></p>
              <ul>{recent.map((r) => <li key={r}><button type="button" className="im-item" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(r); input.current?.focus(); }}><span>{r}</span></button></li>)}</ul>
            </div>
          ) : null}
          {coords ? (
            <div role="presentation">
              <p className="im-legend-h">{s.coords}</p>
              <div id={`${inputId}-opt-0`} role="option" aria-selected className="im-hit" data-active="true" aria-disabled={!coords.insideSriLanka}>
                <button type="button" className="im-item" disabled={!coords.insideSriLanka} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(rows[0])}>
                  <span><MapPinIcon aria-hidden="true" /> {fmt(s.goTo, { lat: coords.lat.toFixed(4), lng: coords.lng.toFixed(4) })}</span>
                  {!coords.insideSriLanka ? <small>{s.outside}</small> : null}
                </button>
              </div>
            </div>
          ) : null}
          {enabled && result.isFetching && !result.data ? <div className="im-skel" aria-busy="true"><span className="im-shimmer" /><span className="im-shimmer" /><span className="im-shimmer" /></div> : null}
          {enabled && result.isError ? <p className="rs-help" role="alert">{s.error}</p> : null}
          {enabled && result.data && result.data.groups.length === 0 ? <div><p className="rs-help" role="status">{fmt(s.noResults, { q: debounced })}</p><p className="rs-help">{s.suggestions}</p></div> : null}
          {enabled ? result.data?.groups.map((g) => (
            <div key={g.layer} role="presentation">
              <p className="im-legend-h">{label(g.layer)}</p>
              <ul role="presentation">
                {g.items.map((item) => {
                  index += 1;
                  const i = index;
                  return (
                    <li key={`${item.layer}${item.id}`} role="presentation">
                      <div id={`${inputId}-opt-${i}`} role="option" aria-selected={i === safeActive} className="im-hit" data-active={i === safeActive}>
                        <button type="button" className="im-item" onMouseDown={(e) => e.preventDefault()} onMouseMove={() => setActive(i)} onClick={() => choose({ kind: "item", item })}>
                          <span className="im-hit-title"><Highlight text={title(item)} q={debounced} />{item.subtitle ? <small>{item.layer === "places" && item.badge === "district" && item.subtitle ? placeName(item.subtitle, locale) : item.subtitle}</small> : null}</span>
                          <span className="im-hit-badges">
                            {statusText(item) ? <span className="rs-nb-chip">{statusText(item)}</span> : null}
                            {item.badge === "DEMO" ? <span className="im-prov" data-kind="DEMO">{copy.provenance.DEMO}</span> : null}
                            {item.noLocation ? <span className="im-prov">{s.noLocation}</span> : null}
                          </span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {g.hasMore ? <p className="rs-help">{s.more}</p> : null}
            </div>
          )) : null}
        </div>
      ) : null}
      <p className="rs-help">{s.footnote}</p>
    </div>
  );
}
