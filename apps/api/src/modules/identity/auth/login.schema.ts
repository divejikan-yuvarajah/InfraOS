import { z } from "zod";

import {
  BCRYPT_MAX_UTF8_BYTES,
  PASSWORD_MIN_LENGTH,
} from "../registration.schema.js";

const email = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());

const password = z.string().superRefine((value, context) => {
  if (value.length < PASSWORD_MIN_LENGTH) {
    context.addIssue({ code: "custom", message: "password is too short" });
  }
  if (Buffer.byteLength(value, "utf8") > BCRYPT_MAX_UTF8_BYTES) {
    context.addIssue({
      code: "custom",
      message: "password exceeds 72 UTF-8 bytes",
    });
  }
});

/** Allowlisted login body. Extra keys, including role or status, are rejected. */
export const loginBodySchema = z
  .object({
    email,
    password,
  })
  .strict();

export type LoginBody = z.infer<typeof loginBodySchema>;
