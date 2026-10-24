import {
  connectDatabase,
  disconnectDatabase,
} from "../../src/config/database.js";
import { assertSafeTestDatabaseName } from "../../src/config/env.js";
import { Agency } from "../../src/modules/agencies/models/agency.model.js";
import { EmailVerificationChallenge } from "../../src/modules/identity/models/email-verification-challenge.model.js";
import { PasswordResetChallenge } from "../../src/modules/identity/models/password-reset-challenge.model.js";
import { RefreshFamily } from "../../src/modules/identity/models/refresh-family.model.js";
import { RefreshSession } from "../../src/modules/identity/models/refresh-session.model.js";
import { Role } from "../../src/modules/identity/models/role.model.js";
import { User } from "../../src/modules/identity/models/user.model.js";
import type { AppEnv } from "../../src/config/env.js";

let mongod: { getUri: () => string; stop: () => Promise<boolean> } | undefined;

export function testMongoEnv(uri: string): AppEnv {
  return {
    NODE_ENV: "test",
    PORT: 4000,
    FRONTEND_ORIGIN: "http://localhost:3000",
    LOG_LEVEL: "silent",
    API_PREFIX: "/api/v1",
    MONGODB_URI: uri,
    MONGODB_DB_NAME: "infraos_test",
  };
}

export async function startIsolatedMongo(): Promise<AppEnv> {
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const source = testMongoEnv(uri);
  assertSafeTestDatabaseName(source.NODE_ENV, source.MONGODB_DB_NAME);
  await connectDatabase(source);
  return source;
}

export async function clearCoreCollections(): Promise<void> {
  assertSafeTestDatabaseName("test", "infraos_test");
  await Promise.all([
    User.deleteMany({}),
    Role.deleteMany({}),
    Agency.deleteMany({}),
    RefreshSession.deleteMany({}),
    RefreshFamily.deleteMany({}),
    EmailVerificationChallenge.deleteMany({}),
    PasswordResetChallenge.deleteMany({}),
  ]);
}

export async function stopIsolatedMongo(): Promise<void> {
  await disconnectDatabase();
  await mongod?.stop();
  mongod = undefined;
}
