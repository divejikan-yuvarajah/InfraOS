import { EnvValidationError } from "../../../config/env.js";
import type { AppEnv, NodeEnv } from "../../../config/env.js";

export type SeedEnvSlice = Pick<AppEnv, "NODE_ENV" | "MONGODB_DB_NAME">;

const APPROVED_DEMO_DB = /^infraos_(dev|test)$/i;

/** Step 12 core seed: non-production only; refuses `_prod` database names. */
export function assertCoreSeedEnvironment(source: SeedEnvSlice): void {
  if (source.NODE_ENV === "production") {
    throw new EnvValidationError([
      { name: "NODE_ENV", message: "core seed refuses production" },
    ]);
  }
  if (source.MONGODB_DB_NAME && /_prod$/i.test(source.MONGODB_DB_NAME)) {
    throw new EnvValidationError([
      {
        name: "MONGODB_DB_NAME",
        message: "core seed refuses production database names",
      },
    ]);
  }
}

/** Step 15 demo seed: development/test only and approved database name. */
export function assertDemoSeedEnvironment(source: SeedEnvSlice): void {
  const nodeEnv = source.NODE_ENV;
  if (nodeEnv !== "development" && nodeEnv !== "test") {
    throw new EnvValidationError([
      {
        name: "NODE_ENV",
        message: "demo seed allows only development or test",
      },
    ]);
  }
  assertCoreSeedEnvironment(source);

  const dbName = source.MONGODB_DB_NAME;
  if (!dbName || !APPROVED_DEMO_DB.test(dbName)) {
    throw new EnvValidationError([
      {
        name: "MONGODB_DB_NAME",
        message: "demo seed requires infraos_dev or infraos_test",
      },
    ]);
  }
}

export function seedEnvFromProcess(env: AppEnv): SeedEnvSlice {
  return {
    NODE_ENV: env.NODE_ENV,
    MONGODB_DB_NAME: env.MONGODB_DB_NAME,
  };
}

export function isAllowedSeedNodeEnv(nodeEnv: NodeEnv): boolean {
  return nodeEnv === "development" || nodeEnv === "test";
}
