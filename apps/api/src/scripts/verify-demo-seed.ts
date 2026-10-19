import {
  connectDatabase,
  disconnectDatabase,
} from "../config/database.js";
import { env } from "../config/env.js";
import {
  formatVerifyReport,
  verifyDemoSeed,
} from "../database/seeds/demo/verify-demo.js";
import { assertDemoSeedEnvironment, seedEnvFromProcess } from "../database/seeds/helpers/seed-guard.js";

async function main(): Promise<void> {
  const seedEnv = seedEnvFromProcess(env);
  assertDemoSeedEnvironment(seedEnv);
  await connectDatabase(env);
  const result = await verifyDemoSeed();
  console.log(formatVerifyReport(result));
  await disconnectDatabase();
  if (!result.pass) {
    process.exitCode = 1;
  }
}

main().catch(async (error: unknown) => {
  console.error("INFRAOS demo verify: FAIL");
  console.error(error instanceof Error ? error.message : "verify failed");
  try {
    await disconnectDatabase();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
