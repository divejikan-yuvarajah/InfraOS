# Data table accessibility

- Sortable headers are buttons. The header cell sets `aria-sort` to `ascending`, `descending`, or `none`.
- Search has a visible label.
- Previous and Next are real buttons and disable at the ends. Unknown totals do not invent a last page; Next stays disabled unless `hasNextPage` is true.
- The table region sets `aria-busy` while loading.
- Empty, error, and retry text are in the table, not color alone.
- Horizontal overflow stays inside the bordered scroll container.
- Keyboard and 320/375/768/1280 checks: manual, not run in automation.
