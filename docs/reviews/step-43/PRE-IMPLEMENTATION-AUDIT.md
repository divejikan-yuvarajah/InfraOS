# Step 43 pre-implementation audit

**When:** 2026-10-25 00:20 +05:30  
**Checkout:** `C:\Users\ASUS\Desktop\InfraOS\InfraOS`  
**Starting point:** `6d23348` on `feature/auth-password-recovery`, matching `origin/development` and `origin/main`.  
**Worktrees:** this checkout only.  
**Untracked before the branch:** `Prompts/INFRAOS_Steps_43_44_Enhanced_Development_Prompt.md`. It was left untracked.

## Step 42 gate

The owner asked for this step after publishing `6d23348`. That is the acceptance to start Step 43. GitHub presence is not Atlas approval and not a live reset-mail demo. Atlas indexes stay **NOT RUN**. This step does not connect to MongoDB.

## What already existed

- Next middleware only sets `x-infraos-public-locale`. It cannot see the memory JWT or the API-host refresh cookie.
- Auth state was module memory with an epoch, and refresh was already single-flight. React did not subscribe to it.
- `sanitizeNextParam` allowed a broad `/si` and `/ta` prefix and dropped query strings.
- No private page existed. Public routes are the landing page, about, how-it-works, faq, contact, privacy, accessibility, and their `/si` and `/ta` copies, plus login, forgot-password, and reset-password.
- `/verify-email`, `/public-map`, `/public-projects`, `/report-issue`, `/403`, `/404`, `/500`, and `/maintenance` are policy names. They are not implemented pages.
- Staff catalog prefixes (`/projects`, `/roadsync`, `/map`, `/contractors`, `/assets`, `/documents`, `/inspections`, `/issues`, `/notifications`, `/reports`, `/profile`, `/settings`, `/admin`) are not implemented pages.
- `AppProviders` already bootstraps one refresh. TanStack Query exists. Production `getAuthAvailability()` stays `preview`.

## Decision

Classify paths in the client. Guard private prefixes in the root client tree. Add only `/dashboard` as the workspace shell. Do not add Express authentication in this step.
