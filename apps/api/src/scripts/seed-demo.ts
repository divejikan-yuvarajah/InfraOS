import {
  connectDatabase,
  disconnectDatabase,
} from "../config/database.js";
import { env } from "../config/env.js";
import { seedDemoData } from "../database/seeds/demo/seed-demo.js";
import { seedEnvFromProcess } from "../database/seeds/helpers/seed-guard.js";

async function main(): Promise<void> {
  const seedEnv = seedEnvFromProcess(env);
  await connectDatabase(env);
  const summary = await seedDemoData(seedEnv);
  console.log("INFRAOS demo seed: PASS");
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    "Demo interactive login accounts: DEFERRED (fixture users are PENDING/non-login).",
  );
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  console.error("INFRAOS demo seed: FAIL");
  console.error(error instanceof Error ? error.message : "seed failed");
  try {
    await disconnectDatabase();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
