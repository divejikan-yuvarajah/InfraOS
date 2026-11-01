/**
 * Adds missing canonical SUPER_ADMIN grants to the stored role. Dry run by default.
 *
 *   tsx src/scripts/sync-super-admin-permissions.ts
 *   tsx src/scripts/sync-super-admin-permissions.ts --apply --confirm-db=<MONGODB_DB_NAME>
 *
 * Applying requires the database name to be typed back, and refuses production.
 * Never prints the connection string. Requires separate owner approval before running
 * against any persistent database.
 */
import { connectDatabase, disconnectDatabase, sanitizeMongoError } from "../config/database.js";
import { env } from "../config/env.js";
import { assertCoreSeedEnvironment, seedEnvFromProcess } from "../database/seeds/helpers/seed-guard.js";
import { syncSuperAdminPermissions } from "../modules/identity/seed/sync-super-admin-permissions.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const confirmed = args.find((arg) => arg.startsWith("--confirm-db="))?.slice("--confirm-db=".length);

  assertCoreSeedEnvironment(seedEnvFromProcess(env));
  if (!env.MONGODB_URI || !env.MONGODB_DB_NAME) throw new Error("MONGODB_URI and MONGODB_DB_NAME are required");
  if (apply && confirmed !== env.MONGODB_DB_NAME) {
    throw new Error("--apply requires --confirm-db=<the exact MONGODB_DB_NAME>");
  }

  await connectDatabase(env);
  try {
    const result = await syncSuperAdminPermissions(apply);
    console.log(
      JSON.stringify(
        {
          database: env.MONGODB_DB_NAME,
          mode: apply ? "apply" : "dry-run",
          roleFound: result.found,
          wouldAddOrAdded: result.add,
          applied: result.applied,
          storedGrantsAboveCeilingReviewManually: result.aboveCeiling,
        },
        null,
        2,
      ),
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error: unknown) => {
  console.error("sync failed:", error instanceof Error ? sanitizeMongoError(error) : "unknown");
  process.exit(1);
});
