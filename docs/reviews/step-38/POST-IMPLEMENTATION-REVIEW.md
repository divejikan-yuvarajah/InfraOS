# Step 38 post-implementation review

## Findings addressed

| Severity | Issue | Fix |
|---|---|---|
| P1 | Importing `@infraos/shared-types` from client transport broke Turbopack production build | Manual envelope parsing in `transport.ts`; web-local `AuthUserDto` |
| P1 | `/si/login` and `/ta/login` would miss auth layout scoping | `LoginPageShell` wraps `[data-infra-app]` and imports auth CSS for all locales |
| P2 | Global `credentials: "include"` on all API calls | Default `omit`; auth login POST opts in |

## Residual

- SI/TA login copy is draft; native review **PENDING**.
- Live login requires Step 39 backend and `NEXT_PUBLIC_AUTH_LOGIN_ENABLED=1`.
- No axe/Lighthouse run recorded.

Verdict: **APPROVE RECOMMENDED** pending owner UI review.
