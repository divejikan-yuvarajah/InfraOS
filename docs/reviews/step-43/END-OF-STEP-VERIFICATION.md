# Step 43 end-of-step verification

**When:** 2026-10-25 00:40 +05:30  
**Branch:** `feature/auth-protected-access` at base `6d23348`. Uncommitted. Not pushed.  
**Worktrees:** this checkout only.  
**Reviewer:** same session that wrote the code. This is a self-review, not a second person.

| Check | Result | Evidence |
|---|---|---|
| Middleware still locale-only | **PASS** | `apps/web/src/middleware.ts` has no auth logic |
| No Step 44 / 45 / 46 code | **PASS** | No `requireAuthenticated`, no `/auth/me`, no API diff |
| Public landing source | **PASS** | `app/page.tsx` not in the diff. Browser `/` and `/si` still render the public headlines |
| SSR private HTML | **PASS** | `GET /dashboard` status 200. Body contains "Checking your session". It does not contain "Operational modules" or `accessToken` |
| API-down `/dashboard` | **PASS** | Heading "The workspace could not be checked", `role=alert`, Try again. No workspace sentence. `localStorage` and `sessionStorage` empty. Focused element was `H1` |
| Fixture 401 refresh | **PASS** (page fixture, not the API) | After a stubbed `401 SESSION_EXPIRED` on `/api/v1/auth/refresh`, the browser went to `/login?next=%2Fdashboard` |
| Fixture 503 / real network failure | **PASS** | Real refresh to `localhost:4000` failed because the API was not started. The panel stays on retry and does not send the person to login |
| Signed-in workspace shell | **NOT RUN** | A later fixture sign-in did not leave the login form (`Email is required` / `Password is required` after the fields were cleared). Unit tests cover the default `/dashboard` target |
| Reload with a live refresh cookie | **BLOCKED** | Would need the API. Atlas `autoIndex` is not approved, so the API was not started |
| Logout, back/forward after a real session | **NOT RUN** | No signed-in browser session was established |
| Stale refresh cannot restore identity | **PASS** | `does not let an in-flight refresh replace a newer sign-in` in `auth.test.ts` |
| `/ta/forgot-password` and `/reset-password` | **PASS** | Recovery forms render. Reset stays disabled with no fragment |
| Widths 320, 390, 768, 1024, 1440 | **PASS** | `scrollWidth` equals `clientWidth` on the login page or the dashboard retry panel |
| Reduced motion | **PASS** | Emulated `prefers-reduced-motion: reduce`. Access button `animation` `none`, `transition` `0s` |
| `npm run test:web` | **PASS** | exit 0. 26 files, 127 tests |
| `src/lib/auth/route-access.test.ts` after extra `next` cases | **PASS** | exit 0. 6 tests |
| `npm run test:api` | **PASS** | exit 0. 21 files, 256 tests. No API source change |
| `npm run type-check` | **PASS** | exit 0 |
| `npm run lint` | **PASS** | exit 0. One existing warning in `data-table.tsx` (`react-hooks/incompatible-library`) |
| `npm run build` | **PASS** | exit 0 |
| Atlas indexes / live API | **BLOCKED** | Not approved. No index was created |

## Defect fixed in this pass

An in-flight refresh could apply or clear the memory token after a newer sign-in. `performRefresh` now ignores its result when the epoch or the memory token changed while it was waiting. The new test locks that in.

Self-review recommendation: **APPROVE** for owner testing. Do not commit until asked. Do not start Step 44.
