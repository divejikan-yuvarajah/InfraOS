import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { migrateDocumentChunks } from "../modules/documents/chunk-migration.js";

/** Dry-run by default; pass --commit to write. Point it only at a development or disposable database. Prints counts only. */
async function main(): Promise<void> {
  const commit = process.argv.includes("--commit");
  await connectDatabase(env);
  const report = await migrateDocumentChunks(commit);
  console.log(`INFRAOS documentChunks migration (${report.mode}): PASS`);
  console.log(JSON.stringify(report, null, 2));
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  console.error("INFRAOS documentChunks migration: FAIL");
  console.error(error instanceof Error ? error.message : "migration failed");
  try { await disconnectDatabase(); } catch { /* ignore */ }
  process.exitCode = 1;
});
