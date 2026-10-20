# Step 24 accessibility baseline

Date: 2026-10-20  
Base: `development` @ `5f2caa3` (Step 23 merged: `b4fd988` / PR #24)  
Branch: `feature/step-24-accessibility-foundation`

## Surfaces in scope

| Surface | Exists | Notes |
|---------|--------|--------|
| `/` foundation page | Yes | Dev fixtures for Steps 19–23 |
| `/_not-found` | Yes | |
| App shell | Yes | Dev fixture only; public page not wrapped |
| Forms, table, feedback | Yes | Dev fixtures |

## Automated

Existing contrast unit tests in `src/lib/design/contrast.test.ts`.  
axe / Playwright: **NOT RUN** (not installed).  
Screen reader (NVDA/VoiceOver/TalkBack): **NOT RUN**.

## Manual protocol (follow-up)

1. Tab from page load; confirm skip link appears and moves focus to `#main`.
2. At 320px, open shell menu, Escape, confirm focus returns to the menu button.
3. Submit empty demo form; first invalid field receives focus; summary uses `role="alert"`.
4. Sort a table column; header `aria-sort` changes.
5. 200% zoom: no page-level horizontal scroll except the table region.
