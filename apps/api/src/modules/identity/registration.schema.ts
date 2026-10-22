import { SYSTEM_ROLE_KEYS, type SystemRoleKey } from "@infraos/shared-types";
import { z } from "zod";

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

export const BCRYPT_MAX_UTF8_BYTES = 72;
export const PASSWORD_MIN_LENGTH = 8;

const personName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => !hasControlChar(value), "name contains control characters");

const email = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());

const password = z.string().superRefine((value, context) => {
  if (value.length < PASSWORD_MIN_LENGTH) {
    context.addIssue({
      code: "custom",
      message: "password is too short",
    });
  }
  if (Buffer.byteLength(value, "utf8") > BCRYPT_MAX_UTF8_BYTES) {
    context.addIssue({
      code: "custom",
      message: "password exceeds 72 UTF-8 bytes",
    });
  }
});

export const staffProvisionSchema = z
  .object({
    firstName: personName,
    lastName: personName,
    email,
    password,
    roleKey: z.enum(SYSTEM_ROLE_KEYS),
    agencyCode: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[A-Za-z0-9_]+$/)
      .transform((value) => value.toUpperCase())
      .nullable(),
  })
  .strict();

export type ParsedStaffProvisionInput = z.infer<typeof staffProvisionSchema> & {
  roleKey: SystemRoleKey;
};

const privilegedKeys = [
  "roleId",
  "roleKey",
  "agencyId",
  "agencyCode",
  "status",
  "emailVerified",
  "createdBy",
  "updatedBy",
  "passwordHash",
  "permissions",
] as const;

export function assertNoPrivilegedKeys(body: unknown): void {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new RegistrationInputError("registration body must be an object");
  }
  const record = body as Record<string, unknown>;
  for (const key of privilegedKeys) {
    if (key in record) {
      throw new RegistrationInputError("privileged field is not accepted");
    }
  }
  for (const key of Object.keys(record)) {
    if (key.startsWith("$")) {
      throw new RegistrationInputError("operator keys are not accepted");
    }
  }
}

export class RegistrationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistrationInputError";
  }
}
