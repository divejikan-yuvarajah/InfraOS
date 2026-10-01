export type AppEnv = {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  CLIENT_URL: string;
  LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "silent";
  API_PREFIX: string;
};

function readString(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function readNodeEnv(): AppEnv["NODE_ENV"] {
  const value = process.env.NODE_ENV?.trim();
  if (value === "production" || value === "test" || value === "development") {
    return value;
  }
  return "development";
}

function readLogLevel(): AppEnv["LOG_LEVEL"] {
  const value = process.env.LOG_LEVEL?.trim();
  if (
    value === "fatal" ||
    value === "error" ||
    value === "warn" ||
    value === "info" ||
    value === "debug" ||
    value === "silent"
  ) {
    return value;
  }
  return "info";
}

function readPort(): number {
  const raw = process.env.PORT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 4000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4000;
}

/**
 * Step 9 config foundation. Does not read DB/JWT/AI secrets.
 * Step 10 will replace this with full Zod env validation.
 */
export const env: AppEnv = {
  NODE_ENV: readNodeEnv(),
  PORT: readPort(),
  CLIENT_URL: readString("CLIENT_URL", "http://localhost:3000"),
  LOG_LEVEL: readLogLevel(),
  API_PREFIX: readString("API_PREFIX", "/api/v1").replace(/\/$/, "") || "/api/v1",
};
