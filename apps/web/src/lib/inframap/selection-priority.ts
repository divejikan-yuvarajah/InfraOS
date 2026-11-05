import type { LayerKey } from "./inframap";

/** Conflict > roadwork > project > asset > utility > risk. Within risks, project markers outrank zones (see `score`), so a large polygon never blocks what lies under it. */
export const LAYER_PRIORITY: readonly LayerKey[] = ["conflicts", "roadworks", "projects", "assets", "utilities", "risks"];

export type Candidate = { layer: LayerKey; id: string; title: string; score?: number | null };

/** Removes duplicates (a line is often hit twice), orders by layer priority, then worst conflict score first, then title. */
export function orderCandidates(candidates: readonly Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const key = `${c.layer}:${c.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.sort(
    (a, b) =>
      LAYER_PRIORITY.indexOf(a.layer) - LAYER_PRIORITY.indexOf(b.layer) ||
      (b.score ?? -1) - (a.score ?? -1) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );
}
