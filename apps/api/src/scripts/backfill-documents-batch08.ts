import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { backfillDocuments } from "../modules/documents/document.backfill.js";

/** Dry-run by default. Pass --commit to write. Point it only at a development or disposable database. */
async function main(): Promise<void> {
  const commit = process.argv.includes("--commit");
  await connectDatabase(env);
  const report = await backfillDocuments(commit);
  console.log(`INFRAOS document backfill (${report.mode}): PASS`);
  console.log(JSON.stringify(report, null, 2));
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  console.error("INFRAOS document backfill: FAIL");
  console.error(error instanceof Error ? error.message : "backfill failed");
  try { await disconnectDatabase(); } catch { /* ignore */ }
  process.exitCode = 1;
});
