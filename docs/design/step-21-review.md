# Step 21 review

- Steps 19 and 20 were on `development` (`c251b00`) before this branch.
- Added `@tanstack/react-table` v8. Query helpers include `queryMockTablePage` (search → sort → page).
- Fix batch (2026-10-20): aligned `pageSizeOptions`/`clampPageSize`, selection column, server mock adapter, pagination controls, opt-in global search, empty vs filtered empty copy.
- Remaining gaps vs full Step 21 spec: column filters UI, column visibility, row actions menu, URL/router sync, debounced server search, DOM interaction tests.
- No Express routes or domain list pages.
