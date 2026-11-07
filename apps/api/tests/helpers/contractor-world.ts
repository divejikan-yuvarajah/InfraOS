import { hash } from "bcryptjs";
import type { SystemRoleKey } from "@infraos/shared-types";

import { env } from "../../src/config/env.js";
import { Agency } from "../../src/modules/agencies/models/agency.model.js";
import { signAccessToken } from "../../src/modules/identity/auth/jwt.js";
import { Role } from "../../src/modules/identity/models/role.model.js";
import { User } from "../../src/modules/identity/models/user.model.js";
import { SYSTEM_ROLE_META, SYSTEM_ROLE_PERMISSIONS } from "../../src/modules/identity/seed/system-role-permissions.js";
import { Project } from "../../src/modules/projects/models/project.model.js";
import { dates, id, money, point } from "./domain-fixtures.js";

export function useTokenSecrets(): void {
  env.ACCESS_TOKEN_SECRET = "access-secret-batch04-0123456789abcdef";
  env.REFRESH_TOKEN_SECRET = "refresh-secret-batch04-0123456789abcdef";
}

export async function seedRoles(): Promise<void> {
  for (const key of Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRoleKey[]) {
    await Role.create({ key, name: SYSTEM_ROLE_META[key].name, description: SYSTEM_ROLE_META[key].description, permissions: [...SYSTEM_ROLE_PERMISSIONS[key]], scopeType: SYSTEM_ROLE_META[key].scopeType, isActive: true });
  }
}

export async function makeUser(email: string, role: SystemRoleKey, agencyId: unknown) {
  const roleDoc = await Role.findOne({ key: role });
  if (!roleDoc) throw new Error("missing role");
  const user = await User.create({ firstName: "Staff", lastName: email.split("@")[0], email, passwordHash: await hash("correct-horse-battery", 4), roleId: roleDoc._id, agencyId, status: "ACTIVE", emailVerified: true, credentialEpoch: 0 });
  return { user, token: (await signAccessToken(user._id.toString(), 0)).token };
}

let n = 0;
export async function makeProject(agencyId: unknown, patch: Record<string, unknown> = {}) {
  n += 1;
  return Project.create({ projectCode: `INF-ROAD-${5000 + n}`, title: `Batch04 project ${n}`, projectType: "ROAD", agencyId, createdBy: id(), budget: money, startDate: dates.start, plannedEndDate: dates.end, geometry: point, status: "ACTIVE", ...patch });
}

/** Ministry > child, sibling; plus an unrelated ministry. Users cover every role the contractor module distinguishes. */
export async function contractorWorld() {
  await seedRoles();
  const ministry = await Agency.create({ code: "MIN_WORKS", name: "Works", type: "MINISTRY", status: "ACTIVE" });
  const child = await Agency.create({ code: "RDA_WEST", name: "Western Road", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
  const sibling = await Agency.create({ code: "RDA_SOUTH", name: "Southern Road", type: "DEPARTMENT", status: "ACTIVE", parentAgencyId: ministry._id });
  const other = await Agency.create({ code: "MIN_WATER", name: "Water", type: "MINISTRY", status: "ACTIVE" });
  return {
    ministry, child, sibling, other,
    superUser: await makeUser("super@example.com", "SUPER_ADMIN", ministry._id),
    gov: await makeUser("gov@example.com", "GOV_ADMIN", ministry._id),
    officer: await makeUser("officer@example.com", "AGENCY_OFFICER", child._id),
    siblingOfficer: await makeUser("officer2@example.com", "AGENCY_OFFICER", sibling._id),
    manager: await makeUser("pm@example.com", "PROJECT_MANAGER", child._id),
    otherGov: await makeUser("othergov@example.com", "GOV_ADMIN", other._id),
    contractorUser: await makeUser("contractor@example.com", "CONTRACTOR", child._id),
    inspector: await makeUser("inspector@example.com", "INSPECTOR", child._id),
    citizen: await makeUser("citizen@example.com", "CITIZEN", child._id),
  };
}
export type World = Awaited<ReturnType<typeof contractorWorld>>;
