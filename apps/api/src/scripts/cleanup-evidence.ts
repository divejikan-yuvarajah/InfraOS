import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { cleanupEvidence } from "../modules/inspections/evidence-cleanup.js";

/** Dry-run by default. Pass --commit to delete. Point it only at a development or disposable database. */
async function main(): Promise<void> {
  const commit = process.argv.includes("--commit");
  await connectDatabase(env);
  const report = await cleanupEvidence(commit);
  console.log(`INFRAOS evidence cleanup (${report.mode}): PASS`);
  console.log(JSON.stringify(report, null, 2));
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  console.error("INFRAOS evidence cleanup: FAIL");
  console.error(error instanceof Error ? error.message : "cleanup failed");
  try { await disconnectDatabase(); } catch { /* ignore */ }
  process.exitCode = 1;
});
