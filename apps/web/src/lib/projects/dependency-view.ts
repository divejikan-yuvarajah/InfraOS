export type DependencyPrerequisite =
  | { visibility: "visible"; projectId: string; projectCode: string; title: string; projectStatus: string }
  | { visibility: "restricted" };

export type DependencyLinkView = {
  id: string;
  direction: "depends_on";
  scheduling: "informational";
  prerequisite: DependencyPrerequisite;
  recordedAt: string;
};

export function dependencyQueryKey(epoch: string, userId: string, roleKey: string, projectId: string): readonly string[] {
  return ["project-dependencies", epoch, userId, roleKey, projectId];
}

export function canEditDependencies(roleKey: string): boolean {
  return roleKey === "PROJECT_MANAGER" || roleKey === "AGENCY_OFFICER" || roleKey === "GOV_ADMIN";
}

export function directionSentence(code: string, title: string): string {
  return `This project depends on ${code} ${title}. The link does not change dates or status.`;
}

export function dependencyFailure(status: number): "invalid" | "denied" | "missing" | "conflict" | "unavailable" {
  if (status === 400 || status === 415) return "invalid";
  if (status === 401 || status === 403) return "denied";
  if (status === 404) return "missing";
  if (status === 409) return "conflict";
  return "unavailable";
}
