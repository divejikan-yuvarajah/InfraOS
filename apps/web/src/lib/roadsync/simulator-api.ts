import { apiClient } from "@/lib/api/client";

import { guard, moved, type Envelope } from "./api";
import type { Lever, SavedScenario, SimResult, Visibility } from "./simulator";

const base = "/api/v1/roadsync";
type Method = "GET" | "POST" | "DELETE";
async function call<T>(path: string, method: Method, body?: unknown): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<T>>(path, { method, authenticated: true, ...(body !== undefined ? { body } : {}) });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
const enc = encodeURIComponent;
export const runSimulation = (conflictId: string, levers: Lever[]) => call<{ result: SimResult }>(`${base}/conflicts/${enc(conflictId)}/simulate`, "POST", { levers });
export const fetchScenarios = (conflictId: string) => call<{ items: SavedScenario[] }>(`${base}/conflicts/${enc(conflictId)}/scenarios`, "GET");
export const saveScenario = (conflictId: string, body: { name: string; visibility: Visibility; levers: Lever[] }) => call<{ id: string }>(`${base}/conflicts/${enc(conflictId)}/scenarios`, "POST", body);
export const removeScenario = (id: string) => call<{ deleted: boolean }>(`${base}/scenarios/${enc(id)}`, "DELETE");
