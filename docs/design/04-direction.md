# 04 — Design direction and system: "Site Plan" (Phase 4)

The owner approved Direction B on 2026-11-01. It is a modern business SaaS product drafted like a site plan: a light warm canvas, a faint engineering grid, route-line geometry as the status language, and honesty states as first-class components.

## 1. Implemented in this phase

| Layer | File | Purpose |
|---|---|---|
| Tokens + component CSS | `apps/web/src/styles/site-plan.css` | `--sp-*` tokens (canvas, grid, materials, density, tones, tints) and `sp-*` component styles |
| Pure logic | `apps/web/src/lib/design/site-plan.ts` | status → node shape/tone, lifecycle rail model, dual progress, honesty chips, coverage mapping |
| Tests | `apps/web/src/lib/design/site-plan.test.ts` | 14 tests: shapes, rail (incl. off-path and cancelled), progress honesty, measured contrast |
| Components | `apps/web/src/components/site-plan/site-plan.tsx` | `StatusNode`, `StatusChip`, `HonestyChip`, `LifecycleRail`, `DualProgress`, `FactsList`, `ContextBar` |

No page uses these components yet. Pages adopt them from Phase 5, so this phase changes no screen.

## 2. Tokens

Brand colours are unchanged (`tokens.css`: orange `#FF5B00`, yellow `#FEB600`, maroon `#8C1F28`, green `#279541`, charcoal `#111827`).

| Token group | Values | Rule |
|---|---|---|
| Canvas | `--sp-canvas #faf8f4` + 24 px grid at 4.5% charcoal | Warm off-white page; cards stay white |
| Materials | radius 6 / 12 / 16 px; `--sp-lift-0/1/2` | Hairline ring first; shadow only for floating layers |
| Density | rows 48 px (comfortable) / 36 px (compact) | Tables offer both (Phase 6) |
| Node tones | neutral, pending, hold, active, critical, success, each with a *fill* colour and a *text* colour | Brand colours for fills and shapes; derived darker shades for text |

### Measured contrast (WCAG 2.2 AA)
The computed ratios are listed below. Each text pair is asserted ≥ 4.5 in `site-plan.test.ts`.

| Pair | Ratio | Use |
|---|---|---|
| Charcoal `#111827` on canvas `#faf8f4` | 16.72 | body text |
| Secondary `#475569` on canvas | 7.14 | secondary text |
| Muted `#64748b` on white | 4.76 | captions (minimum) |
| Orange text `#b63d00` on orange tint `#fff3ea` | 5.27 | Active chip |
| Yellow text `#6c5311` on yellow tint `#fff8e6` | 6.88 | Pending chip, Provisional chip |
| Green text `#166b30` on green tint `#ecfdf3` | 6.26 | Success chip |
| Maroon `#8c1f28` on critical tint `#fdecee` | 7.86 | Delayed/critical chip |
| Charcoal on orange button `#ff5b00` | 5.70 | primary button label |
| Orange `#ff5b00` on white | 3.11 | **fill/icon only**, never text (meets 3:1 non-text) |
| Yellow `#feb600` on white | 1.76 | **fill only**; always paired with a shape and a text label |

## 3. Signature components

### S1 · Route-line status language (`StatusNode`, `StatusChip`)
Each status combines a shape, a tone and a text label:

| Shape | Meaning | Project statuses | Work statuses |
|---|---|---|---|
| dash ― | not started | Draft | Draft |
| ring ○ | waiting | Submitted, Under review | Submitted, Planned |
| half ◐ | paused | On hold | — |
| filled ● | moving / cleared | Approved (green), Active (orange) | Approved, Active |
| diamond ◆ | needs action | Delayed (maroon) | — |
| check ✓ | finished | Completed | Completed |
| cross ⊗ | ended | Rejected (maroon), Cancelled (grey) | Cancelled |

- Every status keeps its text label; the shape is a second channel that survives greyscale, so colour is never the only signal.
- The shape is `aria-hidden`; the label is the accessible name.

### S2 · Lifecycle rail (`LifecycleRail`)
- Shows the main path Draft → Submitted → Under review → Approved → Active → Completed.
- Steps before the current one are "passed". This is inferred from the current status only; no dates or history are claimed.
- On hold, Delayed and Rejected are drawn as a **branch flag** off their anchor step, not as steps.
- Cancelled marks no step: a project can be cancelled from several states and the API does not say which.
- Uses `aria-current="step"` and visually hidden "(passed / current stage / not reached)" text.

### S3 · Dual progress (`DualProgress`)
- Shows physical and financial progress as two tracks.
- Physical always carries **Reported**; financial always carries **Provisional** and has a hatched yellow fill.
- A missing value shows "—", a dashed empty track and an **Unavailable** chip. No zero is invented.
- Values are clamped to 0–100.

### S4 · Honesty chips (`HonestyChip`)
- Kinds: `Provisional`, `Reported`, `Unavailable`, `Withheld`, `Demo data`.
- A dashed outline and transparent fill, so they never read as a status.
- Each has an icon and a visually hidden hint; the hint also appears as a tooltip title.
- `coverageHonesty()` maps the dashboard's `coverage.*` values to chips.

### S5 · Drafting canvas + context bar (`.sp-canvas`, `ContextBar`)
- `ContextBar` holds breadcrumbs (`nav` + `ol`, last item `aria-current="page"`), a scope pill, an "As of" time and an actions slot.
- Scope and as-of render only when the page has real values.
- The shell's title and description header stays; the context bar sits directly under it on every page from Phase 5.

### Supporting · Facts list (`FactsList`)
- A labelled-row `dl` that replaces scattered fact cards.
- Missing values read "Not provided" (overridable) in muted italic. Values are never blank.

## 4. Typography, motion, i18n
- Fonts already loaded: Manrope (display), Geist (body), Geist Mono, and Noto Sans Sinhala / Tamil as per-script fallbacks.
- Numbers use tabular figures (`.sp-num`, progress values).
- Under `:lang(si)` / `:lang(ta)`, `.sp-text` gets line-height 1.75, and honesty chips drop uppercase and letter-spacing, which do not apply to those scripts.
  - **1.75 is a starting value, not a measured one.** It will be measured on real pages in Phase 5 (02-landscape R16 found no authoritative figure).
- Motion: only the progress fill animates (300 ms), and it is disabled under `prefers-reduced-motion`.

## 5. Pattern catalogue (rules for Phases 5+)
1. **Context bar first** under the shell header on every page.
2. **Action before history:** on any page with an attention list, it is the first content block, with completed items de-emphasised.
3. **Record pages:** context bar → identity row (title, status chip, meta tags) → lifecycle rail → tabs → a two-column body (facts list | progress and next items) that collapses to one column under 960 px.
4. **Status vs tag:** lifecycle status uses `StatusChip`; work type, project type and agency code are neutral tags, never coloured.
5. **Money** always carries `HonestyChip kind="provisional"`. A physical % always carries `kind="reported"`.
6. **One orange fill per view** (primary action). Focus rings stay orange.
7. **No toasts for important outcomes.** Use located banners (Primer/Stripe, 02-landscape R7/R9).

## 6. Verification (this phase)

| Check | Result |
|---|---|
| `npm run test -w @infraos/web -- src/lib/design/site-plan.test.ts` | 14/14 passed |
| `npm run type-check:web` | exit 0 |
| `npx eslint` (3 new TS/TSX files) | exit 0 |

- **Visual check: deferred to Phase 5.** The components are not mounted on any page yet, and the repo has no component-render test tooling (vitest runs `.ts` in a node environment).
- **Uniqueness test:** not run this phase (the plan schedules it after Phases 1, 2 and 6). The Phase 1 baseline is in 01-audit §5.
