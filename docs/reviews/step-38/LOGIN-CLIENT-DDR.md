# Step 38 login UI and client decision record

## Scope

- Routes: `/login`, `/si/login`, `/ta/login` with `noindex` metadata on `/login` layout.
- Premium Civic Systems auth shell: ink corridor panel (desktop), light form workspace, Sora/DM Sans via local internal tokens.
- Typed client: `AuthClientPhase`, memory-only access token holder, preview transport until Step 39.
- No Express login route, no JWT issuance, no refresh cookie, no protected app middleware, no role picker, no staff signup.

## Availability modes

| Mode | When | Behavior |
|---|---|---|
| `preview` | Default (incl. production) | Submit returns `NOT_LIVE` message; banner states Step 39 required |
| `live` | `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1` (Step 39) | POST `/api/v1/auth/login` with `credentials: include` |
| `fixture` | Tests inject `AuthTransport` | Never enabled in production bundles for success |

## Redirect policy

`next` query parameter accepts same-origin relative paths under an allowlist (`/`, `/about`, `/si/*`, `/login`, etc.). Rejects `//`, `https:`, backslashes, and `@`.

## Password handling

Email trimmed and lowercased. Password **not** trimmed. No logging, storage, or URL embedding of credentials.

## Q-002

Unchanged. Successful future login (Step 39) must still respect server eligibility rules; Step 38 client does not infer activation from `emailVerified`.
