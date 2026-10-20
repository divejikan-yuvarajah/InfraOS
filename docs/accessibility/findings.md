# Accessibility findings (Step 24)

| ID | Sev | WCAG | Finding | Status |
|----|-----|------|---------|--------|
| A11Y-001 | P1 | 2.4.1 | Skip link text and focusable main target | **Fixed** — label + `#main` `tabIndex={-1}` + shared constants |
| A11Y-002 | P2 | 1.4.10 / 2.1.1 | Table horizontal scroll keyboard access | **Fixed** — focusable scroll `region` (browser: named regions on `/`) |
| A11Y-003 | P2 | 2.4.7 | Shell skip link focus ring | **Fixed** — `outline-ring` on shell skip |
| A11Y-004 | P2 | 2.4.11 | Focus under sticky chrome | **Partial** — `scroll-mt-16`; viewport verify **NOT RUN** |
| A11Y-005 | P1 | (process) | No axe / automated route scan | **Open** — axe not installed; **NOT RUN** |
| A11Y-006 | P1 | (process) | Screen reader pass | **Open** — **NOT RUN** |
| A11Y-007 | P1 | 2.1.1 / 4.1.2 | Full keyboard matrix (drawer, select, date picker, tabs) | **Open** — not exercised in Step 24 diff; manual **NOT RUN** |
| A11Y-008 | P2 | 3.3.x | Form audit beyond existing Step 20 fixture | **N/A new fixes** — relies on prior implementation; no Step 24 code change |
| A11Y-009 | P2 | — | Misleading “PASS (code)” in test matrix without automated proof | **Fixed** — matrix corrected; landmark unit test added |
| A11Y-010 | P2 | 1.3.1 | Step 24 spec breadth vs 4-file patch | **Documented** — foundation pass is incremental, not full WCAG certification |

Independent review (2026-10-20): No P0 keyboard trap confirmed in code or browser snapshot. Dialog/Sheet remain Radix-managed.
