import { apiClient } from "@/lib/api/client";
import { guard, moved, type Envelope } from "@/lib/roadsync/api";

import { bboxParam, LAYER_PATH, type Bbox, type LayerData, type LayerKey } from "./inframap";

/** One bounded layer read. A response that arrives after sign-out or a user switch is discarded. */
export async function fetchLayer(layer: LayerKey, bbox: Bbox, signal?: AbortSignal): Promise<LayerData> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<LayerData>>(`/api/v1/inframap/${LAYER_PATH[layer]}?bbox=${encodeURIComponent(bboxParam(bbox))}`, {
    method: "GET",
    authenticated: true,
    ...(signal ? { signal } : {}),
  });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
