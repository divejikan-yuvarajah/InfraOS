import { z } from "zod";

import {
  BCRYPT_MAX_UTF8_BYTES,
  PASSWORD_MIN_LENGTH,
} from "./registration.schema.js";

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

export const resetPasswordBodySchema = z
  .object({
    token: z.string().trim().min(43).max(43),
    password,
  })
  .strict();
