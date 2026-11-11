import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

/**
 * Canonical env catalog (INC-005 closed).
 * Architecture / ADR names win over Step 7 prompt aliases.
 *
 * Rejected aliases: JWT_SECRET, REFRESH_SECRET, CLIENT_URL,
 * AI_SERVICE_SECRET, AI_SERVICE_URL.
 */

export type NodeEnv = "development" | "test" | "production";
export type LogLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";
export type StorageProvider = "r2" | "local" | "gridfs";

export type AppEnv = {
  NODE_ENV: NodeEnv;
  PORT: number;
  FRONTEND_ORIGIN: string;
  LOG_LEVEL: LogLevel;
  API_PREFIX: string;
  MONGODB_URI?: string;
  MONGODB_DB_NAME?: string;
  ACCESS_TOKEN_SECRET?: string;
  ACCESS_TOKEN_TTL?: string;
  REFRESH_TOKEN_SECRET?: string;
  REFRESH_TOKEN_TTL?: string;
  AI_BASE_URL?: string;
  AI_INTERNAL_SECRET?: string;
  AI_INTERNAL_SECRET_PREVIOUS?: string;
  AI_VISION_MODEL?: string;
  AI_COPILOT_TTL_DAYS?: number;
  AI_VISION_MAX_BYTES?: number;
  OPENROUTER_API_KEY?: string;
  QDRANT_URL?: string;
  QDRANT_API_KEY?: string;
  STORAGE_PROVIDER?: StorageProvider;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_ENDPOINT?: string;
  ADMIN_APPROVAL_EMAIL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
  SMTP_SECURE?: boolean;
  RISK_SCHEDULE_ENABLED?: boolean;
  RISK_SCHEDULE_HOUR?: number;
  RISK_MAX_PROJECTS_PER_RUN?: number;
};

export type EnvIssue = {
  name: string;
  message: string;
};

/** Variable names whose values must never appear in logs or errors. */
export const SECRET_ENV_NAMES = [
  "MONGODB_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "AI_INTERNAL_SECRET",
  "AI_INTERNAL_SECRET_PREVIOUS",
  "OPENROUTER_API_KEY",
  "QDRANT_API_KEY",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "SMTP_PASS",
] as const;

export const REJECTED_ENV_ALIASES: Record<string, string> = {
  JWT_SECRET: "ACCESS_TOKEN_SECRET",
  REFRESH_SECRET: "REFRESH_TOKEN_SECRET",
  CLIENT_URL: "FRONTEND_ORIGIN",
  AI_SERVICE_SECRET: "AI_INTERNAL_SECRET",
  AI_SERVICE_URL: "AI_BASE_URL",
};

const NODE_ENVS = ["development", "test", "production"] as const;
const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;
const STORAGE_PROVIDERS = ["r2", "local", "gridfs"] as const;

const nodeEnvSchema = z.enum(NODE_ENVS);
const logLevelSchema = z.enum(LOG_LEVELS);
const portSchema = z.coerce
  .number({ error: "must be an integer between 1 and 65535" })
  .int({ error: "must be an integer between 1 and 65535" })
  .min(1, { error: "must be an integer between 1 and 65535" })
  .max(65535, { error: "must be an integer between 1 and 65535" });
const httpUrlSchema = z.url({ error: "must be a valid http(s) URL" });
const apiPrefixSchema = z
  .string()
  .regex(/^\/[A-Za-z0-9/_-]+$/, {
    error: "must start with / and contain only path characters",
  });
const secretSchema = z
  .string()
  .min(32, { error: "must be at least 32 characters when set" });
const storageProviderSchema = z.enum(STORAGE_PROVIDERS, {
  error: "must be r2, local or gridfs",
});
const riskScheduleHourSchema = z.coerce
  .number({ error: "must be an integer between 0 and 23" })
  .int({ error: "must be an integer between 0 and 23" })
  .min(0, { error: "must be an integer between 0 and 23" })
  .max(23, { error: "must be an integer between 0 and 23" });
const riskMaxProjectsSchema = z.coerce
  .number({ error: "must be a positive integer" })
  .int({ error: "must be a positive integer" })
  .min(1, { error: "must be at least 1" });

export class EnvValidationError extends Error {
  readonly issues: EnvIssue[];

  constructor(issues: EnvIssue[]) {
    const lines = issues
      .map((issue) => `  - ${issue.name}: ${issue.message}`)
      .join("\n");
    super(`Invalid environment configuration:\n${lines}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function read(source: NodeJS.Dict<string>, name: string): string | undefined {
  return blank(source[name]);
}

function addIssue(issues: EnvIssue[], name: string, message: string): void {
  issues.push({ name, message });
}

function parseWithSchema<T>(
  issues: EnvIssue[],
  name: string,
  schema: z.ZodType<T>,
  raw: string,
): T | undefined {
  const result = schema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  const message = result.error.issues[0]?.message ?? "is invalid";
  addIssue(issues, name, message);
  return undefined;
}

function parseHttpOrigin(
  issues: EnvIssue[],
  name: string,
  raw: string,
): string | undefined {
  if (raw === "*") {
    addIssue(issues, name, "must be an exact origin; wildcards are not allowed");
    return undefined;
  }

  const parsed = parseWithSchema(issues, name, httpUrlSchema, raw);
  if (!parsed) {
    return undefined;
  }

  try {
    const url = new URL(parsed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      addIssue(issues, name, "must use http or https");
      return undefined;
    }
    if (url.username || url.password) {
      addIssue(issues, name, "must not contain credentials");
      return undefined;
    }
    return url.origin;
  } catch {
    addIssue(issues, name, "must be a valid http(s) URL");
    return undefined;
  }
}

function parseOptionalUrl(
  issues: EnvIssue[],
  name: string,
  raw: string | undefined,
): string | undefined {
  if (!raw) {
    return undefined;
  }
  return parseHttpOrigin(issues, name, raw);
}

function parseOptionalSecret(
  issues: EnvIssue[],
  name: string,
  raw: string | undefined,
): string | undefined {
  if (!raw) {
    return undefined;
  }
  return parseWithSchema(issues, name, secretSchema, raw);
}

/**
 * Load `apps/api/.env` when present. Skipped in tests so local secrets
 * cannot leak into the test process. Existing process.env wins.
 */
export function loadLocalEnvFile(
  source: NodeJS.ProcessEnv = process.env,
): void {
  if (source.NODE_ENV === "test") {
    return;
  }

  const fromCwd = resolve(process.cwd(), ".env");
  const fromPackage = resolve(
    fileURLToPath(new URL("../..", import.meta.url)),
    ".env",
  );
  const path = existsSync(fromCwd)
    ? fromCwd
    : existsSync(fromPackage)
      ? fromPackage
      : undefined;

  if (!path) {
    return;
  }

  process.loadEnvFile(path);
}

export type MongoConfig = {
  uri: string;
  dbName: string;
};

export function isMongoConnectionString(value: string): boolean {
  return /^mongodb(\+srv)?:\/\//i.test(value);
}

/**
 * Automated tests must not target production-like database names.
 */
export function assertSafeTestDatabaseName(
  nodeEnv: NodeEnv,
  dbName: string | undefined,
): void {
  if (nodeEnv !== "test") {
    return;
  }

  if (!dbName || !/_test$/i.test(dbName)) {
    throw new EnvValidationError([
      {
        name: "MONGODB_DB_NAME",
        message: "must end with _test when NODE_ENV=test",
      },
    ]);
  }
}

/** Development and test processes must not silently use a `_prod` database. */
export function assertNonProductionDatabaseName(
  nodeEnv: NodeEnv,
  dbName: string,
): void {
  if (nodeEnv !== "production" && /_prod$/i.test(dbName)) {
    throw new EnvValidationError([
      {
        name: "MONGODB_DB_NAME",
        message: "must not end with _prod outside NODE_ENV=production",
      },
    ]);
  }
}

/**
 * Required for connect, db:check, and production startup.
 * Does not print URI values.
 */
export function requireMongoConfig(source: AppEnv): MongoConfig {
  const issues: EnvIssue[] = [];

  if (!source.MONGODB_URI) {
    issues.push({
      name: "MONGODB_URI",
      message: "is required to connect to MongoDB",
    });
  } else if (!isMongoConnectionString(source.MONGODB_URI)) {
    issues.push({
      name: "MONGODB_URI",
      message: "must start with mongodb:// or mongodb+srv://",
    });
  }

  if (!source.MONGODB_DB_NAME) {
    issues.push({
      name: "MONGODB_DB_NAME",
      message: "is required to connect to MongoDB",
    });
  }

  if (issues.length > 0 || !source.MONGODB_URI || !source.MONGODB_DB_NAME) {
    throw new EnvValidationError(issues);
  }

  const dbName = source.MONGODB_DB_NAME;
  assertSafeTestDatabaseName(source.NODE_ENV, dbName);
  assertNonProductionDatabaseName(source.NODE_ENV, dbName);

  return {
    uri: source.MONGODB_URI,
    dbName,
  };
}

export function parseEnv(
  source: NodeJS.Dict<string> = process.env,
): AppEnv {
  const issues: EnvIssue[] = [];

  for (const [alias, canonical] of Object.entries(REJECTED_ENV_ALIASES)) {
    if (read(source, alias)) {
      addIssue(
        issues,
        alias,
        `is not a canonical name; use ${canonical} instead`,
      );
    }
  }

  const rawNodeEnv = read(source, "NODE_ENV");
  const nodeEnv = rawNodeEnv
    ? parseWithSchema(issues, "NODE_ENV", nodeEnvSchema, rawNodeEnv)
    : "development";

  const rawPort = read(source, "PORT");
  const port = rawPort
    ? parseWithSchema(issues, "PORT", portSchema, rawPort)
    : 4000;

  const rawOrigin = read(source, "FRONTEND_ORIGIN");
  let frontendOrigin: string | undefined;
  if (rawOrigin) {
    frontendOrigin = parseHttpOrigin(issues, "FRONTEND_ORIGIN", rawOrigin);
  } else if (nodeEnv === "production") {
    addIssue(
      issues,
      "FRONTEND_ORIGIN",
      "is required in production (no localhost default)",
    );
  } else {
    frontendOrigin = "http://localhost:3000";
  }

  const rawLogLevel = read(source, "LOG_LEVEL");
  const logLevel = rawLogLevel
    ? parseWithSchema(issues, "LOG_LEVEL", logLevelSchema, rawLogLevel)
    : "info";

  const rawPrefix = read(source, "API_PREFIX");
  let apiPrefix = "/api/v1";
  if (rawPrefix) {
    const normalized = rawPrefix.replace(/\/+$/, "") || "/";
    const parsed = parseWithSchema(
      issues,
      "API_PREFIX",
      apiPrefixSchema,
      normalized,
    );
    if (parsed) {
      apiPrefix = parsed;
    }
  }

  const mongodbUri = read(source, "MONGODB_URI");
  const mongodbDbName = read(source, "MONGODB_DB_NAME");
  if (mongodbUri && !isMongoConnectionString(mongodbUri)) {
    addIssue(
      issues,
      "MONGODB_URI",
      "must start with mongodb:// or mongodb+srv://",
    );
  }
  if (mongodbUri && !mongodbDbName) {
    addIssue(
      issues,
      "MONGODB_DB_NAME",
      "is required when MONGODB_URI is set",
    );
  }
  const accessTokenSecret = parseOptionalSecret(
    issues,
    "ACCESS_TOKEN_SECRET",
    read(source, "ACCESS_TOKEN_SECRET"),
  );
  const accessTokenTtl = read(source, "ACCESS_TOKEN_TTL");
  const refreshTokenSecret = parseOptionalSecret(
    issues,
    "REFRESH_TOKEN_SECRET",
    read(source, "REFRESH_TOKEN_SECRET"),
  );
  const refreshTokenTtl = read(source, "REFRESH_TOKEN_TTL");
  const aiBaseUrl = parseOptionalUrl(
    issues,
    "AI_BASE_URL",
    read(source, "AI_BASE_URL"),
  );
  const aiInternalSecret = parseOptionalSecret(
    issues,
    "AI_INTERNAL_SECRET",
    read(source, "AI_INTERNAL_SECRET"),
  );
  const aiInternalSecretPrevious = parseOptionalSecret(
    issues,
    "AI_INTERNAL_SECRET_PREVIOUS",
    read(source, "AI_INTERNAL_SECRET_PREVIOUS"),
  );
  const aiVisionModel = read(source, "AI_VISION_MODEL");
  const rawCopilotTtl = read(source, "AI_COPILOT_TTL_DAYS");
  const copilotTtlDays = rawCopilotTtl && Number.isInteger(Number(rawCopilotTtl)) && Number(rawCopilotTtl) >= 1 && Number(rawCopilotTtl) <= 3650
    ? Number(rawCopilotTtl)
    : undefined;
  const rawVisionMaxBytes = read(source, "AI_VISION_MAX_BYTES");
  const visionMaxBytes = rawVisionMaxBytes && Number.isInteger(Number(rawVisionMaxBytes)) && Number(rawVisionMaxBytes) >= 1024
    ? Number(rawVisionMaxBytes)
    : undefined;
  const openrouterApiKey = read(source, "OPENROUTER_API_KEY");
  const qdrantUrl = parseOptionalUrl(
    issues,
    "QDRANT_URL",
    read(source, "QDRANT_URL"),
  );
  const qdrantApiKey = read(source, "QDRANT_API_KEY");
  const rawStorage = read(source, "STORAGE_PROVIDER");
  const storageProvider = rawStorage
    ? parseWithSchema(
        issues,
        "STORAGE_PROVIDER",
        storageProviderSchema,
        rawStorage,
      )
    : undefined;
  const r2AccountId = read(source, "R2_ACCOUNT_ID");
  const r2AccessKeyId = read(source, "R2_ACCESS_KEY_ID");
  const r2SecretAccessKey = read(source, "R2_SECRET_ACCESS_KEY");
  const r2Bucket = read(source, "R2_BUCKET");
  const r2Endpoint = read(source, "R2_ENDPOINT");

  const adminApprovalEmail = read(source, "ADMIN_APPROVAL_EMAIL");
  const smtpHost = read(source, "SMTP_HOST");
  const rawSmtpPort = read(source, "SMTP_PORT");
  const smtpPort = rawSmtpPort
    ? parseWithSchema(issues, "SMTP_PORT", portSchema, rawSmtpPort)
    : undefined;
  const smtpUser = read(source, "SMTP_USER");
  const smtpPass = read(source, "SMTP_PASS");
  const smtpFrom = read(source, "SMTP_FROM");
  const rawSmtpSecure = read(source, "SMTP_SECURE");
  const smtpSecure = rawSmtpSecure === "true" || rawSmtpSecure === "1";

  const rawRiskScheduleEnabled = read(source, "RISK_SCHEDULE_ENABLED");
  const riskScheduleEnabled = rawRiskScheduleEnabled !== undefined
    ? rawRiskScheduleEnabled === "true" || rawRiskScheduleEnabled === "1"
    : undefined;
  const rawRiskScheduleHour = read(source, "RISK_SCHEDULE_HOUR");
  const riskScheduleHour = rawRiskScheduleHour
    ? parseWithSchema(issues, "RISK_SCHEDULE_HOUR", riskScheduleHourSchema, rawRiskScheduleHour)
    : undefined;
  const rawRiskMaxProjects = read(source, "RISK_MAX_PROJECTS_PER_RUN");
  const riskMaxProjectsPerRun = rawRiskMaxProjects
    ? parseWithSchema(issues, "RISK_MAX_PROJECTS_PER_RUN", riskMaxProjectsSchema, rawRiskMaxProjects)
    : undefined;

  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  return {
    NODE_ENV: nodeEnv ?? "development",
    PORT: port ?? 4000,
    FRONTEND_ORIGIN: frontendOrigin ?? "http://localhost:3000",
    LOG_LEVEL: logLevel ?? "info",
    API_PREFIX: apiPrefix,
    ...(mongodbUri ? { MONGODB_URI: mongodbUri } : {}),
    ...(mongodbDbName ? { MONGODB_DB_NAME: mongodbDbName } : {}),
    ...(accessTokenSecret ? { ACCESS_TOKEN_SECRET: accessTokenSecret } : {}),
    ...(accessTokenTtl ? { ACCESS_TOKEN_TTL: accessTokenTtl } : {}),
    ...(refreshTokenSecret ? { REFRESH_TOKEN_SECRET: refreshTokenSecret } : {}),
    ...(refreshTokenTtl ? { REFRESH_TOKEN_TTL: refreshTokenTtl } : {}),
    ...(aiBaseUrl ? { AI_BASE_URL: aiBaseUrl } : {}),
    ...(aiInternalSecret ? { AI_INTERNAL_SECRET: aiInternalSecret } : {}),
    ...(aiInternalSecretPrevious ? { AI_INTERNAL_SECRET_PREVIOUS: aiInternalSecretPrevious } : {}),
    ...(aiVisionModel ? { AI_VISION_MODEL: aiVisionModel } : {}),
    ...(copilotTtlDays !== undefined ? { AI_COPILOT_TTL_DAYS: copilotTtlDays } : {}),
    ...(visionMaxBytes !== undefined ? { AI_VISION_MAX_BYTES: visionMaxBytes } : {}),
    ...(openrouterApiKey ? { OPENROUTER_API_KEY: openrouterApiKey } : {}),
    ...(qdrantUrl ? { QDRANT_URL: qdrantUrl } : {}),
    ...(qdrantApiKey ? { QDRANT_API_KEY: qdrantApiKey } : {}),
    ...(storageProvider ? { STORAGE_PROVIDER: storageProvider } : {}),
    ...(r2AccountId ? { R2_ACCOUNT_ID: r2AccountId } : {}),
    ...(r2AccessKeyId ? { R2_ACCESS_KEY_ID: r2AccessKeyId } : {}),
    ...(r2SecretAccessKey ? { R2_SECRET_ACCESS_KEY: r2SecretAccessKey } : {}),
    ...(r2Bucket ? { R2_BUCKET: r2Bucket } : {}),
    ...(r2Endpoint ? { R2_ENDPOINT: r2Endpoint } : {}),
    ...(adminApprovalEmail ? { ADMIN_APPROVAL_EMAIL: adminApprovalEmail } : {}),
    ...(smtpHost ? { SMTP_HOST: smtpHost } : {}),
    ...(smtpPort ? { SMTP_PORT: smtpPort } : {}),
    ...(smtpUser ? { SMTP_USER: smtpUser } : {}),
    ...(smtpPass ? { SMTP_PASS: smtpPass } : {}),
    ...(smtpFrom ? { SMTP_FROM: smtpFrom } : {}),
    ...(rawSmtpSecure !== undefined ? { SMTP_SECURE: smtpSecure } : {}),
    ...(riskScheduleEnabled !== undefined ? { RISK_SCHEDULE_ENABLED: riskScheduleEnabled } : {}),
    ...(riskScheduleHour !== undefined ? { RISK_SCHEDULE_HOUR: riskScheduleHour } : {}),
    ...(riskMaxProjectsPerRun !== undefined ? { RISK_MAX_PROJECTS_PER_RUN: riskMaxProjectsPerRun } : {}),
  };
}

loadLocalEnvFile();

export const env: AppEnv = parseEnv(process.env);
