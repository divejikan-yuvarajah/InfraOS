import { z } from "zod";

/**
 * Browser-safe public config only.
 * Never read ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, MONGODB_URI,
 * AI_INTERNAL_SECRET, or storage credentials here.
 */

const publicUrlSchema = z.url({ error: "must be a valid http(s) URL" });

export class PublicEnvError extends Error {
  readonly name = "PublicEnvError";
  readonly variable: string;

  constructor(variable: string, message: string) {
    super(`${variable}: ${message}`);
    this.variable = variable;
  }
}

function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function parsePublicUrl(
  name: string,
  raw: string | undefined,
): string | undefined {
  if (!raw) {
    return undefined;
  }

  const result = publicUrlSchema.safeParse(raw);
  if (!result.success) {
    throw new PublicEnvError(
      name,
      result.error.issues[0]?.message ?? "must be a valid http(s) URL",
    );
  }

  try {
    const url = new URL(result.data);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new PublicEnvError(name, "must use http or https");
    }
    if (url.username || url.password) {
      throw new PublicEnvError(name, "must not contain credentials");
    }
  } catch (error) {
    if (error instanceof PublicEnvError) {
      throw error;
    }
    throw new PublicEnvError(name, "must be a valid http(s) URL");
  }

  return result.data.replace(/\/$/, "");
}

export type PublicEnv = {
  apiBaseUrl: string | undefined;
  mapStyleUrl: string | undefined;
};

export function getPublicEnv(): PublicEnv {
  return {
    apiBaseUrl: parsePublicUrl(
      "NEXT_PUBLIC_API_BASE_URL",
      blank(process.env.NEXT_PUBLIC_API_BASE_URL),
    ),
    mapStyleUrl: parsePublicUrl(
      "NEXT_PUBLIC_MAP_STYLE_URL",
      blank(process.env.NEXT_PUBLIC_MAP_STYLE_URL),
    ),
  };
}

export function getPublicApiBaseUrl(): string | undefined {
  return getPublicEnv().apiBaseUrl;
}
