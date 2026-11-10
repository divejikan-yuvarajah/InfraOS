export function canHintRisk(roleKey?: string | null): boolean {
  if (!roleKey) return false;
  return ["SUPER_ADMIN", "GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"].includes(roleKey);
}

export function canResolveRisk(roleKey?: string | null): boolean {
  if (!roleKey) return false;
  return ["GOV_ADMIN", "AGENCY_OFFICER", "PROJECT_MANAGER"].includes(roleKey);
}
