/** Opaque refresh cookie. Host-only; Path covers login and refresh only. */
export const REFRESH_COOKIE_NAME = "infraos_refresh";

export const ACCESS_TOKEN_ISSUER = "infraos-api";
export const ACCESS_TOKEN_AUDIENCE = "infraos-web";

/** ADR-006 access lifetime. Env may only shorten this. */
export const ACCESS_TOKEN_MAX_SECONDS = 15 * 60;

/** ADR-006 absolute refresh lifetime. Rotation must not extend it. */
export const REFRESH_ABSOLUTE_MAX_SECONDS = 7 * 24 * 60 * 60;

/**
 * A second refresh that arrives while the winning request is still committing,
 * or immediately after, is a benign race. Reuse after this window revokes the family.
 */
export const REFRESH_REUSE_GRACE_MS = 10_000;

export const AUTH_COOKIE_PATH = "/api/v1/auth";
