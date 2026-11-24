"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { DataSourceBadge } from "@/components/common/civic-atlas-primitives";
import { PortalShell } from "./portal-shell";
import type { AuthLocale } from "@/lib/auth/types";
import { attachBasemapFallback, resolveMapStyle, SRI_LANKA_BOUNDS, SRI_LANKA_MAX_BOUNDS } from "@/lib/inframap/map-style";
import { fetchPublicMapFeatures } from "@/lib/public/api";
import { PORTAL_COPY } from "@/lib/public/messages";

type SelectedFeature =
  | { kind: "PROJECT"; title: string; slug: string; status: string; district?: string | null; lng: number; lat: number }
  | { kind: "ISSUE"; referenceNo: string; category: string; status: string; district?: string | null; lng: number; lat: number };

export function PortalMapClient({ locale = "en" }: { locale?: AuthLocale }) {
  const copy = PORTAL_COPY[locale];
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [bbox, setBbox] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [offlineBasemap, setOfflineBasemap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedFeature | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["public-map-features", bbox],
    queryFn: () => fetchPublicMapFeatures(bbox),
  });

  const districts = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.projects ?? []) if (p.district) set.add(p.district);
    for (const i of data?.issues ?? []) if (i.district) set.add(i.district);
    return [...set].sort();
  }, [data]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.projects ?? []).filter((p) => {
      if (districtFilter && p.district !== districtFilter) return false;
      if (q && !p.title.toLowerCase().includes(q) && !(p.district ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, districtFilter, search]);

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.issues ?? []).filter((i) => {
      if (districtFilter && i.district !== districtFilter) return false;
      if (q && !i.referenceNo.toLowerCase().includes(q) && !i.category.toLowerCase().includes(q) && !(i.district ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, districtFilter, search]);

  const handleLocateMe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocateError("Location lookup is not supported by this browser.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13, duration: 900 });
      },
      () => {
        setLocating(false);
        setLocateError("Location permission was denied or unavailable. No location is stored on our servers.");
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  };

  useEffect(() => {
    if (viewMode !== "map" || !mapContainerRef.current) return;
    let active = true;
    let cleanupFallback: (() => void) | null = null;

    void import("maplibre-gl").then((mod) => {
      if (!active || !mapContainerRef.current || mapRef.current) return;
      if (!mod.getWorkerUrl()) mod.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
      const initialStyle = resolveMapStyle("liberty");
      const map = new mod.Map({
        container: mapContainerRef.current,
        style: initialStyle,
        bounds: SRI_LANKA_BOUNDS,
        fitBoundsOptions: { padding: 24 },
        maxBounds: SRI_LANKA_MAX_BOUNDS,
        attributionControl: { compact: false },
      });
      mapRef.current = map;
      map.addControl(new mod.NavigationControl({ showCompass: true }), "top-right");
      map.addControl(new mod.ScaleControl({ unit: "metric" }), "bottom-left");
      cleanupFallback = attachBasemapFallback(map, initialStyle, {
        onFallback: (offline) => setOfflineBasemap(offline),
      });

      map.on("style.load", () => {
        if (map.getSource("public-features")) return;
        map.addSource("public-features", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "public-projects-layer",
          type: "circle",
          source: "public-features",
          filter: ["==", ["get", "kind"], "PROJECT"],
          paint: {
            "circle-radius": 8,
            "circle-color": "#1d4ed8",
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          },
        });
        map.addLayer({
          id: "public-issues-layer",
          type: "circle",
          source: "public-features",
          filter: ["==", ["get", "kind"], "ISSUE"],
          paint: {
            "circle-radius": 7,
            "circle-color": "#d97706",
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          },
        });
        map.on("click", "public-projects-layer", (e) => {
          const f = e.features?.[0];
          const p = f?.properties as { title?: string; slug?: string; status?: string; district?: string } | undefined;
          if (p?.slug && p?.title) {
            setSelected({
              kind: "PROJECT",
              title: p.title,
              slug: p.slug,
              status: p.status ?? "ACTIVE",
              district: p.district,
              lng: e.lngLat.lng,
              lat: e.lngLat.lat,
            });
          }
        });
        map.on("click", "public-issues-layer", (e) => {
          const f = e.features?.[0];
          const p = f?.properties as { referenceNo?: string; category?: string; status?: string; district?: string } | undefined;
          if (p?.referenceNo) {
            setSelected({
              kind: "ISSUE",
              referenceNo: p.referenceNo,
              category: p.category ?? "ISSUE",
              status: p.status ?? "OPEN",
              district: p.district,
              lng: e.lngLat.lng,
              lat: e.lngLat.lat,
            });
          }
        });
        map.on("mouseenter", "public-projects-layer", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "public-projects-layer", () => { map.getCanvas().style.cursor = ""; });
        map.on("mouseenter", "public-issues-layer", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "public-issues-layer", () => { map.getCanvas().style.cursor = ""; });
      });

      map.on("moveend", () => {
        const b = map.getBounds();
        setBbox(`${b.getWest().toFixed(3)},${b.getSouth().toFixed(3)},${b.getEast().toFixed(3)},${b.getNorth().toFixed(3)}`);
      });
    });

    return () => {
      active = false;
      cleanupFallback?.();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("public-features") as { setData?: (d: unknown) => void } | undefined;
    if (!src?.setData) return;

    const features = [
      ...filteredProjects.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: p.coordinates },
        properties: { kind: "PROJECT", title: p.title, slug: p.slug, status: p.status, district: p.district ?? "" },
      })),
      ...filteredIssues.map((i) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: i.coordinates },
        properties: { kind: "ISSUE", referenceNo: i.referenceNo, category: i.category, status: i.status, district: i.district ?? "" },
      })),
    ];

    src.setData({ type: "FeatureCollection", features });
  }, [filteredProjects, filteredIssues]);

  return (
    <PortalShell locale={locale} activeNav="map">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{copy.mapTitle}</h1>
            {offlineBasemap ? <DataSourceBadge kind="recorded" label="Offline basemap" /> : null}
          </div>
          <p className="text-sm text-slate-600">{copy.mapSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {viewMode === "map" ? (
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locating}
              className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {locating ? "Locating…" : "Disruptions near me"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`min-h-[40px] rounded-md px-3 py-2 text-xs font-medium ${viewMode === "map" ? "bg-blue-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            Map View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`min-h-[40px] rounded-md px-3 py-2 text-xs font-medium ${viewMode === "list" ? "bg-blue-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            {copy.mapListFallback}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <input
          type="search"
          aria-label="Search projects or disruptions"
          placeholder="Search projects, districts, or references…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-[40px] flex-1 min-w-[200px] rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
        />
        <select
          aria-label="Filter by district"
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
          className="min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
        >
          <option value="">All districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {(search || districtFilter) ? (
          <button
            type="button"
            onClick={() => { setSearch(""); setDistrictFilter(""); }}
            className="min-h-[40px] rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        ) : null}
      </div>

      {locateError ? (
        <p role="status" className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {locateError}
        </p>
      ) : null}

      {viewMode === "map" ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <div ref={mapContainerRef} className="h-[520px] w-full" aria-label={copy.mapTitle} />
          {selected ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs">
              <div>
                <div className="font-semibold text-slate-900">
                  {selected.kind === "PROJECT" ? selected.title : `${selected.referenceNo} · ${selected.category}`}
                </div>
                <div className="text-slate-600">
                  {selected.district || "Sri Lanka"} · {selected.status}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selected.kind === "PROJECT" ? (
                  <Link href={`/portal/projects/${selected.slug}`} className="rounded-md bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800">
                    View project
                  </Link>
                ) : null}
                <Link
                  href={`/portal/report?lat=${selected.lat.toFixed(5)}&lng=${selected.lng.toFixed(5)}`}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Report near here
                </Link>
                <button type="button" onClick={() => setSelected(null)} className="px-2 py-1 text-slate-500 hover:text-slate-800">
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-700" />
                Released Projects ({filteredProjects.length})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
                Approved Issues ({filteredIssues.length})
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isLoading ? <span>Updating…</span> : null}
              <span className="text-[11px] text-slate-500">
                {offlineBasemap ? "Offline Sri Lanka basemap (Natural Earth)" : "Basemap tiles: OpenFreeMap / OpenStreetMap (IP sent to tile host)"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Released Projects ({filteredProjects.length})</h2>
            <ul className="space-y-2 text-sm">
              {filteredProjects.map((p) => (
                <li key={p.slug} className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <Link href={`/portal/projects/${p.slug}`} className="font-medium text-blue-700 hover:underline">
                      {p.title}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {p.district ?? "Sri Lanka"} · {p.status}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Approved Citizen Issues ({filteredIssues.length})</h2>
            <ul className="space-y-2 text-sm">
              {filteredIssues.map((i) => (
                <li key={i.referenceNo} className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-mono text-xs font-medium text-slate-800">{i.referenceNo}</span>
                    <div className="text-xs text-slate-500">
                      {i.category} · {i.district ?? "Sri Lanka"} · {i.status}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
