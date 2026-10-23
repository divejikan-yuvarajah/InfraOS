# Step 38 security test matrix

| Case | Test / evidence |
|---|---|
| No localStorage/sessionStorage for access token | `auth.test.ts` static source scan |
| Preview transport never succeeds | `auth.test.ts` |
| Open redirect blocked | `auth.test.ts` sanitizeNextParam |
| Nested API failure envelope parsed | `auth.test.ts` + `errors.ts` |
| Password bytes preserved | `auth.test.ts` login schema |
| credentials default omit | `client.ts` + code review |
| credentials include only on auth POST | `transport.ts` |
| No staff signup / role picker | UI review |
| NOT LIVE banner in production | `availability.ts` + build |
| Public landing unchanged | build routes list; no edits to public landing components for Step 38 |

Browser axe / 320–1920 screenshots: **NOT RUN** in this session (capture manually via demo guide).
