import { SYSTEM_ROLE_KEYS } from "@infraos/shared-types";

import { Agency } from "../../../modules/agencies/models/agency.model.js";
import { Role } from "../../../modules/identity/models/role.model.js";
import {
  SYSTEM_ROLE_META,
  SYSTEM_ROLE_PERMISSIONS,
} from "../../../modules/identity/seed/system-role-permissions.js";
import {
  assertCoreSeedEnvironment,
  type SeedEnvSlice,
} from "../helpers/seed-guard.js";

const CORE_AGENCIES = [
  {
    code: "DEMO_MINISTRY",
    name: "Demo Ministry of Infrastructure",
    shortName: "Demo Ministry",
    type: "MINISTRY" as const,
    description:
      "Development/demo only. Not an official Government of Sri Lanka organization.",
    parentCode: null,
  },
  {
    code: "DEMO_RDA",
    name: "Demo Road Development Authority",
    shortName: "Demo RDA",
    type: "ROAD" as const,
    description: "Development/demo only. Not an official agency code.",
    parentCode: "DEMO_MINISTRY",
  },
  {
    code: "DEMO_WATER",
    name: "Demo National Water Board",
    shortName: "Demo Water",
    type: "WATER" as const,
    description: "Development/demo only. Not an official agency code.",
    parentCode: "DEMO_MINISTRY",
  },
  {
    code: "DEMO_ELEC",
    name: "Demo Electricity Board",
    shortName: "Demo Electricity",
    type: "ELECTRICITY" as const,
    description: "Development/demo only. Not an official agency code.",
    parentCode: "DEMO_MINISTRY",
  },
] as const;

export async function seedCoreIdentity(
  seedEnv: SeedEnvSlice,
): Promise<{ roles: number; agencies: number }> {
  assertCoreSeedEnvironment(seedEnv);

  for (const key of SYSTEM_ROLE_KEYS) {
    const meta = SYSTEM_ROLE_META[key];
    const permissions = [...SYSTEM_ROLE_PERMISSIONS[key]];
    await Role.findOneAndUpdate(
      { key },
      {
        $set: {
          name: meta.name,
          description: meta.description,
          permissions,
          scopeType: meta.scopeType,
          isSystem: true,
          isActive: true,
        },
        $setOnInsert: { key },
      },
      { upsert: true, runValidators: true },
    );
  }

  const agenciesByCode = new Map<string, string>();
  for (const agency of CORE_AGENCIES) {
    const parentId = agency.parentCode
      ? agenciesByCode.get(agency.parentCode)
      : undefined;
    const doc = await Agency.findOneAndUpdate(
      { code: agency.code },
      {
        $set: {
          name: agency.name,
          shortName: agency.shortName,
          type: agency.type,
          description: agency.description,
          status: "ACTIVE",
          parentAgencyId: parentId ?? null,
        },
        $setOnInsert: { code: agency.code },
      },
      { upsert: true, new: true, runValidators: true },
    );
    if (doc) {
      agenciesByCode.set(agency.code, doc._id.toString());
    }
  }

  return {
    roles: SYSTEM_ROLE_KEYS.length,
    agencies: CORE_AGENCIES.length,
  };
}
