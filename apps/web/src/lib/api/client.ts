import { getPublicApiBaseUrl } from "@/lib/env/public";

import { ApiError, parseApiError } from "./errors";

export { ApiError } from "./errors";

export type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Default `omit`. Pass `include` only for cookie-backed auth routes (Step 39+). */
  credentials?: RequestCredentials;
};

/**
 * Single HTTP client for INFRAOS web.
 * Feature modules should import this instead of calling fetch directly.
 * Auth refresh and Bearer attachment are added in the identity step.
 */
export async function apiClient<T>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError(
      "API base URL is not configured. Set NEXT_PUBLIC_API_BASE_URL.",
      500,
      { code: "CONFIG" },
    );
  }

  const { body, headers, credentials, ...rest } = init;
  const hasJsonBody = body !== undefined && body !== null;
  const response = await fetch(
    `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`,
    {
      ...rest,
      credentials: credentials ?? "omit",
      headers: {
        Accept: "application/json",
        ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: hasJsonBody
        ? typeof body === "string"
          ? body
          : JSON.stringify(body)
        : undefined,
    },
  );

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw parseApiError(response.status, response.statusText, payload);
  }

  return payload as T;
}
