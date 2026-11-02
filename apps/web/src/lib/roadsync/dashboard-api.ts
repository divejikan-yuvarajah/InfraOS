import { apiClient } from "@/lib/api/client";

import { guard, moved, type Envelope } from "./api";
import type { AgenciesOut, Brief, CalOut, MapOut, Overview } from "./dashboard";

export { downloadFile } from "./conflict-records-api";

const base = "/api/v1/roadsync/dashboard";
async function get<T>(path: string): Promise<T> {
  const { atEpoch, tokenAtStart } = guard();
  const payload = await apiClient<Envelope<T>>(path, { method: "GET", authenticated: true });
  moved(atEpoch, tokenAtStart);
  return payload.data;
}
export const fetchOverview = (query: string, refresh = false) => get<Overview>(`${base}/overview?${query}${refresh ? "&refresh=true" : ""}`);
export const fetchDashMap = (query: string) => get<MapOut>(`${base}/map?${query}`);
export const fetchCalendar = (query: string) => get<CalOut>(`${base}/calendar?${query}`);
export const fetchDashAgencies = (query: string) => get<AgenciesOut>(`${base}/agencies?${query}`);
export const fetchBrief = (query: string) => get<Brief>(`${base}/brief?${query}`);
export const dashboardCsvPath = (query: string) => `${base}/export.csv?${query}`;
