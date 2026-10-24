import { getPublicApiBaseUrl } from "@/lib/env/public";

import { ApiError, parseApiError } from "./errors";

export { ApiError } from "./errors";

export type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Default `omit`. Pass `include` only for cookie-backed auth routes (Step 39+). */
  credentials?: RequestCredentials;
  /**
   * Attach the in-memory access token. On a safe GET/HEAD 401, try one refresh
   * and retry once. GET /auth/me uses this. It does not replay mutations.
   */
  authenticated?: boolean;
};

/**
 * Single HTTP client for INFRAOS web.
 * Feature modules should import this instead of calling fetch directly.
 * Auth refresh and Bearer attachment are added in the identity step.
 */
function isAuthCookiePath(path: string): boolean {
  return (
    path.includes("/auth/login") ||
    path.includes("/auth/refresh") ||
    path.includes("/auth/logout")
  );
}

function isSafeRetry(method: string | undefined): boolean {
  const normalized = (method ?? "GET").toUpperCase();
  return normalized === "GET" || normalized === "HEAD";
}

export async function apiClient<T>(
  path: string,
  init: ApiRequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError(
      "API base URL is not configured. Set NEXT_PUBLIC_API_BASE_URL.",
      500,
      { code: "CONFIG" },
    );
  }

  const { body, headers, credentials, authenticated, ...rest } = init;
  const memoryToken =
    authenticated
      ? (await import("@/lib/auth/state")).getMemoryAccessToken()
      : null;
  const hasJsonBody = body !== undefined && body !== null;
  const response = await fetch(
    `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`,
    {
      ...rest,
      credentials: credentials ?? "omit",
      headers: {
        Accept: "application/json",
        ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
        ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
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
    const error = parseApiError(response.status, response.statusText, payload);
    if (
      allowRefresh &&
      authenticated &&
      error.status === 401 &&
      isSafeRetry(init.method) &&
      !isAuthCookiePath(path)
    ) {
      const { refreshAuthSessionSingleFlight } = await import(
        "@/lib/auth/refresh-flight"
      );
      const refreshed = await refreshAuthSessionSingleFlight();
      if (refreshed.ok) {
        return apiClient<T>(path, init, false);
      }
    }
    throw error;
  }

  return payload as T;
}
