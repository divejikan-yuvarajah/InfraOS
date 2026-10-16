import {
  connectDatabase,
  disconnectDatabase,
  pingDatabase,
  sanitizeMongoError,
} from "../config/database.js";
import { env, EnvValidationError, requireMongoConfig } from "../config/env.js";

/**
 * Developer diagnostic. Never print URI, password, or Atlas host details.
 */
async function main(): Promise<void> {
  try {
    requireMongoConfig(env);
    await connectDatabase(env);
    await pingDatabase();
    await disconnectDatabase();
    console.log("INFRAOS MongoDB check: PASS");
    console.log(`Database environment: ${env.NODE_ENV}`);
  } catch (error) {
    const reason =
      error instanceof EnvValidationError
        ? error.message
        : sanitizeMongoError(error);
    console.error("INFRAOS MongoDB check: FAIL");
    console.error(reason);
    process.exitCode = 1;
    try {
      await disconnectDatabase();
    } catch {
      // ignore cleanup failure after a failed check
    }
  }
}

await main();
