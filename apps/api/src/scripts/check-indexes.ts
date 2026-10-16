import mongoose from "mongoose";

import {
  connectDatabase,
  disconnectDatabase,
  sanitizeMongoError,
} from "../config/database.js";
import { env, EnvValidationError, requireMongoConfig } from "../config/env.js";
import { inspectIndexes } from "../shared/database/index-inspection.js";
import { INDEX_MODELS } from "../shared/database/index-models.js";

async function main(): Promise<void> {
  try {
    requireMongoConfig(env);
    // The check must remain read-only even in development and test.
    await connectDatabase(env, { autoIndex: false });
    const reports = await inspectIndexes(mongoose.connection, INDEX_MODELS);
    console.log(JSON.stringify(reports, null, 2));
    if (reports.some((report) => report.missing.length || report.mismatch.length)) {
      process.exitCode = 1;
    }
  } catch (error) {
    const reason = error instanceof EnvValidationError
      ? error.message
      : sanitizeMongoError(error);
    console.error("INFRAOS MongoDB index check: FAIL");
    console.error(reason);
    process.exitCode = 1;
  } finally {
    try {
      await disconnectDatabase();
    } catch {
      // Preserve the original check result if cleanup fails.
    }
  }
}

await main();
