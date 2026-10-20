# Step 24 test matrix

| Check | Result | Evidence |
|-------|--------|----------|
| `npm run test -w @infraos/web` | **PASS** | 47 tests (incl. `document-landmarks.test.ts`, `contrast.test.ts`) — run 2026-10-20 |
| `npm run type-check -w @infraos/web` | **PASS** | Same session |
| `npm run lint -w @infraos/web` | **PASS** | 1 pre-existing Step 21 TanStack warning |
| `npm run build -w @infraos/web` | **PASS** | Routes `/`, `/_not-found` |
| Skip link label (automated) | **PASS** | `document-landmarks.test.ts` |
| Skip link behavior (keyboard) | **NOT RUN** | Manual Tab on `/` not recorded |
| axe / eslint-a11y | **NOT RUN** | Not in repo dependencies |
| Keyboard drawer/select/date/tabs | **NOT RUN** | |
| Screen reader (NVDA/VO/TalkBack) | **NOT RUN** | |
| 320 / 375 / 768 / 1280 reflow | **NOT RUN** | |
| 200% / 400% zoom, text spacing | **NOT RUN** | |
| Browser snapshot `/` (dev server) | **PASS (partial)** | Skip link exposed; table scroll regions named; shell nav present |
