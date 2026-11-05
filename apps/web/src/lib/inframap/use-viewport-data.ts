"use client";

import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ufParams, type UF } from "./filters-state";
import { fetchLayer } from "./inframap-api";
import { bboxParam, LAYER_KEYS, type Bbox, type LayerData, type LayerKey } from "./inframap";
import { fetchBboxFor, needsRefetch, zoomBucket, type DeviceProfile } from "./viewport";

/*
 * THE data pipeline. Every layer is fetched here and nowhere else.
 *
 * - The map reports its viewport; after a 250 ms debounce the pipeline decides whether a refetch is needed at all: only if
 *   there is no fetched box yet, the zoom bucket changed, or the viewport left the last fetched box.
 * - The fetched box is the viewport grown by 25 % and rounded outward to a zoom-dependent grid, so small pans reuse the
 *   cached result and tiny differences produce the same query key.
 * - Query key = layer + box + zoom bucket + only the filters that apply to that layer + limit; changing a roadwork filter
 *   never refetches projects. Previous data stays on screen (keepPreviousData); React Query aborts a stale request through
 *   the signal and structural sharing keeps data identity, so the map only calls setData when something really changed.
 * - Disabled and forbidden layers make no request. The browser handles ETag/304 revalidation transparently.
 * Freshness: server is the source of truth; 30 s stale time, refetch on focus/reconnect, 60 s poll while visible.
 */
const DEBOUNCE_MS = 250;
const STALE_MS = 30_000;
const POLL_MS = 60_000;

export type PipelineStats = { requests: number; lastMs: number | null; lastLayer: LayerKey | null };
export type LayerResult = { data: LayerData | undefined; isFetching: boolean; isError: boolean; error: unknown; refetch: () => unknown; dataUpdatedAt: number };

type Args = {
  userId: string;
  keyOf: (scope: string, id: string) => readonly unknown[];
  shown: Record<LayerKey, boolean>;
  uf: UF;
  profile: DeviceProfile;
};

export function useViewportData({ userId, keyOf, shown, uf, profile }: Args) {
  const [viewport, setViewport] = useState<{ bbox: Bbox; zoom: number } | null>(null);
  const [fetched, setFetched] = useState<{ bbox: Bbox; zoom: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetched = useRef<{ bbox: Bbox; zoom: number } | null>(null);
  const stats = useRef<PipelineStats>({ requests: 0, lastMs: null, lastLayer: null });

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onViewport = useCallback((bbox: Bbox, zoom: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setViewport({ bbox, zoom });
      if (needsRefetch(lastFetched.current, bbox, zoom)) {
        const next = { bbox: fetchBboxFor(bbox, zoom, profile.gridMultiplier), zoom };
        lastFetched.current = next;
        setFetched(next);
      }
    }, DEBOUNCE_MS);
  }, [profile.gridMultiplier]);

  const results = useQueries({
    queries: LAYER_KEYS.map((layer) => ({
      queryKey: keyOf("inframap", `${layer}:${fetched ? bboxParam(fetched.bbox) : "none"}:${fetched ? zoomBucket(fetched.zoom) : 0}:${ufParams(uf, layer)}:${profile.limit}`),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const started = performance.now();
        stats.current.requests += 1;
        const data = await fetchLayer(layer, fetched!.bbox, uf, { zoom: fetched!.zoom, limit: profile.limit }, signal);
        stats.current.lastMs = Math.round(performance.now() - started);
        stats.current.lastLayer = layer;
        return data;
      },
      enabled: Boolean(userId) && Boolean(fetched) && shown[layer],
      placeholderData: keepPreviousData,
      staleTime: STALE_MS, refetchInterval: POLL_MS, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: false,
    })),
  });

  // `data` keeps its identity until a layer's own data changes, so the map calls setData only when something really changed.
  const [d0, d1, d2, d3, d4, d5] = results.map((r) => r.data);
  const data = useMemo(
    () => Object.fromEntries(LAYER_KEYS.map((k, i) => [k, [d0, d1, d2, d3, d4, d5][i]])) as Partial<Record<LayerKey, LayerData>>,
    [d0, d1, d2, d3, d4, d5],
  );
  const queries = results.length ? (Object.fromEntries(LAYER_KEYS.map((k, i) => [k, results[i] as unknown as LayerResult])) as Record<LayerKey, LayerResult>) : ({} as Record<LayerKey, LayerResult>);
  const refetchAll = useCallback(() => { LAYER_KEYS.forEach((k, i) => { if (shown[k]) void results[i]!.refetch(); }); }, [results, shown]);
  return { queries, data, viewport, fetched, onViewport, refetchAll, stats };
}
