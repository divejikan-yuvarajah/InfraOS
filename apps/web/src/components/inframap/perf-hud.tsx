"use client";

import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { LAYER_KEYS, type LayerData, type LayerKey } from "@/lib/inframap/inframap";
import type { PipelineStats } from "@/lib/inframap/use-viewport-data";

/** Development-only performance HUD (?perf=1 or Ctrl+Shift+P). It is never rendered in a production build. */
export function PerfHud({ data, stats }: { data: Partial<Record<LayerKey, LayerData>>; stats: { current: PipelineStats } }) {
  const inFlight = useIsFetching();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  return (
    <div className="im-hud" role="status" aria-label="performance">
      <b>perf</b> in flight {inFlight} · requests {stats.current.requests} · last {stats.current.lastMs ?? "–"} ms {stats.current.lastLayer ?? ""}
      {heap ? ` · heap ${(heap / 1048576).toFixed(0)} MB` : ""}
      <br />{LAYER_KEYS.map((k) => `${k}:${data[k]?.features.length ?? 0}`).join(" ")}
    </div>
  );
}
