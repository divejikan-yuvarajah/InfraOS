import { apiClient } from "@/lib/api/client";

import { guard, moved, type Envelope } from "./api";
import type { DetectionResult, PreviewResult } from "./nearby";
import type { GeometryInput } from "./work-requests-view";

export type PreviewBody = {
  geometry: GeometryInput;
  schedule?: { plannedStart: string; plannedEnd: string };
  radiusMeters: number;
  excludeRequestId?: string;
};

/** Live check for a draft shape. Stores nothing and never blocks the form. */
export async function previewNearby(body: PreviewBody): Promise<PreviewResult> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<PreviewResult>>("/api/v1/roadsync/detect/preview", { method: "POST", authenticated: true, body });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function fetchDetection(id: string, query: string): Promise<DetectionResult> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<DetectionResult>>(`/api/v1/roadsync/work-requests/${encodeURIComponent(id)}/detection?${query}`, { method: "GET", authenticated: true });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}

export async function runDetectionScan(id: string): Promise<void> {
  const { atEpoch, tokenAtStart } = guard();
  await apiClient<Envelope<unknown>>(`/api/v1/roadsync/work-requests/${encodeURIComponent(id)}/detection/run`, { method: "POST", authenticated: true });
  moved(atEpoch, tokenAtStart);
}
