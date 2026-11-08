import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { cleanupDocumentUploads } from "../modules/documents/document-cleanup.js";

/** Dry-run by default. Pass --commit to delete stale upload tickets and unreferenced document blobs. */
async function main(): Promise<void> {
  const commit = process.argv.includes("--commit");
  await connectDatabase(env);
  console.log(JSON.stringify(await cleanupDocumentUploads(commit), null, 2));
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  console.error("INFRAOS document cleanup: FAIL", error instanceof Error ? error.message : "failed");
  try { await disconnectDatabase(); } catch { /* ignore */ }
  process.exitCode = 1;
});
