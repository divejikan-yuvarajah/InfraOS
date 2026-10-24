# Step 42 browser testing guide

**When:** 2026-10-24 23:55 +05:30  
**Page:** existing Next dev server at `http://localhost:3000` (already running for `apps/web`). A second `dev:web` was not left running.  
**API:** not started. The local API environment points at MongoDB Atlas. Starting it could create indexes because non-production `autoIndex` is on.

No real email was sent. Success, rejected, and unavailable responses were produced by replacing `window.fetch` in that tab for `/auth/reset-password` only. The marker in the fragment was the word `fixture`, not an issued reset token. Screenshots were taken only after the fragment was gone.

| Check | Result | Evidence |
|---|---|---|
| English fragment removed, field enabled | **PASS** | Address bar `/reset-password`, hash empty, input enabled, marker not in body or web storage |
| Sinhala `/si/reset-password` | **PASS** | Heading `නව මුරපදයක් තෝරන්න`, label `නව මුරපදය`, input still enabled, hash empty |
| Tamil `/ta/reset-password` | **PASS** | Heading `புதிய கடவுச்சொல்`, label `புதிய கடவுச்சொல்`, input still enabled |
| Short password | **PASS** | Alert "Use at least 8 characters.", `aria-invalid`, no request required |
| Loading | **PASS** | Button "Updating…", `aria-busy`, input disabled while the fixture response is pending |
| Successful reset | **PASS** (UI fixture) | Status "Your password was updated. Sign in with the new password. This does not sign you in." Password cleared, field disabled |
| Expired or reused token | **PASS** (UI fixture) | Both are the same rejected alert: "This reset link could not be used. Request a new one." Distinct expiry copy is not shown |
| Unavailable / retry | **PASS** (UI fixture) | "Password reset is temporarily unavailable. You can try again." Field enabled again |
| Missing fragment | **PASS** | "This page needs a reset link. Request a new one from sign in." Field disabled |
| Mobile 390×844 | **PASS** | One grid column, input width about 350px, `scrollWidth` equals `clientWidth` |
| Accessibility semantics | **PASS** | `h1`, labelled password input, `autocomplete=new-password`, alert or status, described-by, skip link, submit disabled until a password is present |
| Contrast measurement | **NOT RUN** | No computed contrast ratio |
| Login page still present | **PASS** | `/login` shows email, password, "Forgot password?", and Sign in |
| Live mailbox | **BLOCKED** | No provider |
| Real API consume in the browser | **NOT RUN** | Isolated replica-set tests cover consume |

Sinhala and Tamil body sentences for errors, privacy, and the subtitle still fall back to English. The language switcher and field labels are translated. Native review is still pending.

Repeat the isolated consume proof with:

```powershell
cd C:\Users\ASUS\Desktop\InfraOS\InfraOS
npm run test:api -- --run tests/password-reset-consume.test.ts
```

That command uses a one-node replica set. It does not send mail and it does not touch Atlas.
