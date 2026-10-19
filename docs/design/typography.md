# Typography (Step 18)

## Primary typeface

**Geist Sans** via `next/font/google` (`apps/web/src/app/layout.tsx`).

- Weights loaded: **400, 500, 600, 700** (no synthetic 650).
- `display: swap` for resilient loading.
- **Not switched to Inter** — Geist was already wired in Step 5+ foundation.

### Fallback stack

Defined in `apps/web/src/styles/typography-tokens.css`:

```text
Geist → ui-sans-serif → system-ui → Segoe UI → Noto Sans → Noto Sans Tamil → Noto Sans Sinhala → sans-serif
```

**English, Tamil, and Sinhala:** Geist covers Latin UI copy. Tamil/Sinhala rely on OS/Noto fallbacks when present. This is **not** full localization, guaranteed glyph coverage, or translated UI — only rendering safety for mixed names in data.

**Monospace:** Geist Mono for IDs/code only (`font-mono`), not general government UI.

## Semantic roles

Use utility classes from `globals.css` (prefer over ad-hoc `text-xl` on product screens):

| Class | Role | Typical use |
|---|---|---|
| `type-display` | Display | Rare public hero (Step 25+) |
| `type-page-title` | H1 / page title | App page heading |
| `type-section-title` | H2 | Dashboard sections |
| `type-card-title` | H3 / card title | Cards, panels |
| `type-body` | Body 16px | Paragraphs, default copy |
| `type-body-small` | 14px dense | Tables, metadata rows |
| `type-label` | Label | Form labels, field groups |
| `type-caption` | Caption | Helper text (not core data) |
| `type-metric` | KPI | Financial/risk figures |
| `type-tabular-nums` | Tabular nums | Columns, aligned figures |

CSS variables: `--font-size-*`, `--line-height-*`, `--font-weight-*` in `typography-tokens.css`.

## Rules

- Default app body: **16px** (`--font-size-body`), line-height **1.6**.
- Do not shrink essential project/agency data to 10–11px.
- Avoid ALL CAPS for long agency names, roles, or workflows.
- Long titles: wrap naturally; truncation requires accessible expansion (Step 19+).
- KPIs: use `type-metric` or `type-tabular-nums` for LKR amounts and scores.

## Anti-patterns

- Using `type-display` on operational dashboards.
- Body copy at `text-xs` for primary data fields.
- `font-mono` for agency names or narrative text.
- Assuming Geist alone renders Tamil/Sinhala without fallbacks.
