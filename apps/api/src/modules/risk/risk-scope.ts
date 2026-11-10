import type { AuthenticatedActor } from "../identity/auth/require-authenticated.js";
import {
  projectReadFilter,
  resolveResourceScope,
  type ResourceScope,
} from "../identity/authorization/resource-scope.js";

export const SYSTEM_ACTOR_USER_ID = "000000000000000000000000";

export async function resolveRiskScope(
  actor: AuthenticatedActor,
): Promise<ResourceScope> {
  if (actor.userId === SYSTEM_ACTOR_USER_ID && actor.roleKey === "SUPER_ADMIN") {
    return { kind: "platform" };
  }
  return await resolveResourceScope(actor);
}

export { projectReadFilter, type ResourceScope };
