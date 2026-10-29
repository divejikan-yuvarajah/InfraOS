/**
 * Informational prerequisite links. Direction: dependent projectId depends on prerequisiteProjectId.
 * A link does not reschedule dates or change START/COMPLETE.
 */

export const GRAPH_EDGE_CAP = 200;

export const DEPENDENCY_LINK_TYPE = "PREREQUISITE" as const;

export const DEPENDENCY_WRITABLE_STATUSES = ["DRAFT", "APPROVED", "ACTIVE"] as const;

export function dependencyStatusAllowed(status: string): boolean {
  return (DEPENDENCY_WRITABLE_STATUSES as readonly string[]).includes(status);
}

export type DependencyEdge = { from: string; to: string };

export function prerequisiteReachesDependent(
  prerequisiteId: string,
  dependentId: string,
  edges: readonly DependencyEdge[],
): "cycle" | "clear" | "too_large" {
  if (prerequisiteId === dependentId) return "cycle";
  if (edges.length > GRAPH_EDGE_CAP) return "too_large";
  const next = new Map<string, string[]>();
  for (const edge of edges) {
    const list = next.get(edge.from) ?? [];
    list.push(edge.to);
    next.set(edge.from, list);
  }
  const seen = new Set<string>();
  const stack = [prerequisiteId];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || seen.has(node)) continue;
    if (node === dependentId) return "cycle";
    seen.add(node);
    if (seen.size > GRAPH_EDGE_CAP) return "too_large";
    for (const hop of next.get(node) ?? []) stack.push(hop);
  }
  return "clear";
}
