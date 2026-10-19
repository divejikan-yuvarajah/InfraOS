import {
  connectDatabase,
  disconnectDatabase,
} from "../config/database.js";
import { env } from "../config/env.js";
import { seedCoreIdentity } from "../database/seeds/core/identity.js";
import { seedEnvFromProcess } from "../database/seeds/helpers/seed-guard.js";

export { seedCoreIdentity } from "../database/seeds/core/identity.js";

async function main(): Promise<void> {
  const seedEnv = seedEnvFromProcess(env);
  await connectDatabase(env);
  const result = await seedCoreIdentity(seedEnv);
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
