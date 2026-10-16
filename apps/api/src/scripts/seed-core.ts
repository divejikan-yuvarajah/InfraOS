import { Agency } from "../modules/agencies/models/agency.model.js";
import { Role } from "../modules/identity/models/role.model.js";
import {
  SYSTEM_ROLE_META,
  SYSTEM_ROLE_PERMISSIONS,
} from "../modules/identity/seed/system-role-permissions.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../config/database.js";
import { env, EnvValidationError } from "../config/env.js";
import { SYSTEM_ROLE_KEYS } from "@infraos/shared-types";

const DEMO_AGENCIES = [
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

function assertSeedEnvironment(): void {
  if (env.NODE_ENV === "production") {
    throw new EnvValidationError([
      {
        name: "NODE_ENV",
        message: "core seed refuses production",
      },
    ]);
  }
  if (env.MONGODB_DB_NAME && /_prod$/i.test(env.MONGODB_DB_NAME)) {
    throw new EnvValidationError([
      {
        name: "MONGODB_DB_NAME",
        message: "core seed refuses production database names",
      },
    ]);
  }
}

export async function seedCoreIdentity(): Promise<{
  roles: number;
  agencies: number;
}> {
  assertSeedEnvironment();

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
  for (const agency of DEMO_AGENCIES) {
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
    agencies: DEMO_AGENCIES.length,
  };
}

async function main(): Promise<void> {
  assertSeedEnvironment();
  await connectDatabase(env);
  const result = await seedCoreIdentity();
  console.log("INFRAOS core seed: PASS");
  console.log(`Roles upserted: ${result.roles}`);
  console.log(`Demo agencies upserted: ${result.agencies}`);
  console.log("No users or passwords were created.");
  await disconnectDatabase();
}

const isDirectRun =
  process.argv[1]?.includes("seed-core") ||
  process.argv[1]?.includes("db-seed");

if (isDirectRun) {
  main().catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : "seed failed";
    console.error("INFRAOS core seed: FAIL");
    console.error(message);
    try {
      await disconnectDatabase();
    } catch {
      // ignore
    }
    process.exitCode = 1;
  });
}
