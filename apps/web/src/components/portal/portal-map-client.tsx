"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Map as MlMap } from "maplibre-gl";

import type { AuthLocale } from "@/lib/auth/types";
import { resolveMapStyle, SRI_LANKA_BOUNDS, SRI_LANKA_MAX_BOUNDS } from "@/lib/inframap/map-style";
import { fetchPublicMapFeatures } from "@/lib/public/api";
import { PORTAL_COPY } from "@/lib/public/messages";
import { PortalShell } from "./portal-shell";

export function PortalMapClient({ locale = "en" }: { locale?: AuthLocale }) {
  const copy = PORTAL_COPY[locale];
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [bbox, setBbox] = useState<string>("79.45,5.85,81.95,9.90");
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  const { data, isLoading } = useQuery({
    queryKey: ["public", "map", bbox],
    queryFn: () => fetchPublicMapFeatures(bbox),
  });

  useEffect(() => {
    if (viewMode !== "map" || !mapContainerRef.current) return;
    let active = true;

    void import("maplibre-gl").then((mod) => {
      if (!active || !mapContainerRef.current || mapRef.current) return;
      // The bundler moves maplibre into a chunk, so point it at its own self-contained worker file
      // (same guard as the InfraMap and RoadSync maps; without it the public map fails to start).
      if (!mod.getWorkerUrl()) mod.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
      const map = new mod.Map({
        container: mapContainerRef.current,
        style: resolveMapStyle(),
        bounds: SRI_LANKA_BOUNDS,
        fitBoundsOptions: { padding: 24 },
        maxBounds: SRI_LANKA_MAX_BOUNDS,
        attributionControl: { compact: true },
      });
      mapRef.current = map;

      map.on("load", () => {
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
            "circle-radius": 7,
            "circle-color": "#1d4ed8",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
        map.addLayer({
          id: "public-issues-layer",
          type: "circle",
          source: "public-features",
          filter: ["==", ["get", "kind"], "ISSUE"],
          paint: {
            "circle-radius": 6,
            "circle-color": "#d97706",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      });

      map.on("moveend", () => {
        const b = map.getBounds();
        setBbox(`${b.getWest().toFixed(3)},${b.getSouth().toFixed(3)},${b.getEast().toFixed(3)},${b.getNorth().toFixed(3)}`);
      });
    });

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    const src = map.getSource("public-features") as { setData?: (d: unknown) => void } | undefined;
    if (!src?.setData) return;

    const features = [
      ...data.projects.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: p.coordinates },
        properties: { kind: "PROJECT", title: p.title, slug: p.slug },
      })),
      ...data.issues.map((i) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: i.coordinates },
        properties: { kind: "ISSUE", referenceNo: i.referenceNo, category: i.category },
      })),
    ];

    src.setData({ type: "FeatureCollection", features });
  }, [data]);

  return (
    <PortalShell locale={locale} activeNav="map">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{copy.mapTitle}</h1>
          <p className="text-sm text-slate-600">{copy.mapSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`rounded-md px-3 py-2 text-xs font-medium ${viewMode === "map" ? "bg-blue-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            Map View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-md px-3 py-2 text-xs font-medium ${viewMode === "list" ? "bg-blue-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            {copy.mapListFallback}
          </button>
        </div>
      </div>

      {viewMode === "map" ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <div ref={mapContainerRef} className="h-[520px] w-full" aria-label={copy.mapTitle} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-700" />
                Released Projects ({data?.projects.length ?? 0})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
                Approved Issues ({data?.issues.length ?? 0})
              </span>
            </div>
            {isLoading ? <span>Updating…</span> : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Released Projects ({data?.projects.length ?? 0})</h2>
            <ul className="space-y-2 text-sm">
              {(data?.projects ?? []).map((p) => (
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
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Approved Citizen Issues ({data?.issues.length ?? 0})</h2>
            <ul className="space-y-2 text-sm">
              {(data?.issues ?? []).map((i) => (
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
