# Responsive application shell (Step 23)

`AppShell` in `apps/web/src/components/layout/app-shell.tsx` is a reusable layout for later authenticated-area pages. The public foundation page at `/` stays in the root layout and is not wrapped by this shell.

## Behavior

- Desktop (`lg` and up): left sidebar.
- Smaller widths: header menu opens a left `Sheet` (Escape and close via Radix).
- One shell `<main id="shell-main">` plus a skip link. The document root still has its own skip link to `#main`.
- Live navigation is `APP_NAVIGATION` (`/` Foundation only). `FUTURE_NAVIGATION_PREVIEW` items are disabled labels, not links.
- No user, agency, notification count, or role is rendered unless a caller passes `contextLabel`.

## Page widths

`PageContainer` variants: `dashboard` (max-w-6xl), `content` (max-w-3xl), `form` (max-w-2xl), `map` (full bleed, no map library).
