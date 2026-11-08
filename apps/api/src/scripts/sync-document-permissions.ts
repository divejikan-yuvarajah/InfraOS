/**
 * Adds the Batch 08 DocTrace grants (document.update, document.restrict) to the stored system roles. Dry run by default.
 *
 *   npm run db:sync:document-permissions
 *   npm run db:sync:document-permissions -- --apply --confirm-db=<MONGODB_DB_NAME>
 *
 * Additive ($addToSet), idempotent, never removes a grant, refuses production, never prints the connection string.
 * Requires separate owner approval before running against any persistent database. A fresh `db:seed:core` also sets them.
 */
import { connectDatabase, disconnectDatabase, sanitizeMongoError } from "../config/database.js";
import { env } from "../config/env.js";
import { assertCoreSeedEnvironment, seedEnvFromProcess } from "../database/seeds/helpers/seed-guard.js";
import { syncDocumentPermissions } from "../modules/identity/seed/sync-document-permissions.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const confirmed = args.find((a) => a.startsWith("--confirm-db="))?.slice("--confirm-db=".length);
  assertCoreSeedEnvironment(seedEnvFromProcess(env));
  if (!env.MONGODB_URI || !env.MONGODB_DB_NAME) throw new Error("MONGODB_URI and MONGODB_DB_NAME are required");
  if (apply && confirmed !== env.MONGODB_DB_NAME) throw new Error("--apply requires --confirm-db=<the exact MONGODB_DB_NAME>");
  await connectDatabase(env);
  try {
    console.log(JSON.stringify({ database: env.MONGODB_DB_NAME, mode: apply ? "apply" : "dry-run", roles: await syncDocumentPermissions(apply) }, null, 2));
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error: unknown) => {
  console.error("sync failed:", error instanceof Error ? sanitizeMongoError(error) : "unknown");
  process.exit(1);
});
