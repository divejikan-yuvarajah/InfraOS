import {
  connectDatabase,
  disconnectDatabase,
} from "../config/database.js";
import { env } from "../config/env.js";
import { resetDemoData } from "../database/seeds/demo/reset-demo.js";
import { seedEnvFromProcess } from "../database/seeds/helpers/seed-guard.js";

async function main(): Promise<void> {
  const seedEnv = seedEnvFromProcess(env);
  await connectDatabase(env);
  await resetDemoData(seedEnv);
  console.log("INFRAOS demo reset: PASS");
  console.log("Removed demo-layer records only (roles and core agencies preserved).");
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  console.error("INFRAOS demo reset: FAIL");
  console.error(error instanceof Error ? error.message : "reset failed");
  try {
    await disconnectDatabase();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
