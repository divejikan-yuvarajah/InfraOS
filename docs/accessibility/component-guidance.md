# Component accessibility notes

- Status badges always include a text label (`StatusBadge`).
- Data table headers use buttons and `aria-sort` on `th`.
- Feedback errors use `role="alert"`; loading uses `role="status"` and `aria-busy`.
- Shell navigation uses `aria-current="page"` plus a left border, not color alone.
- Do not put essential instructions only in tooltips.
- Future feature pages should keep one document `main` and reuse the skip link target `#main`.
