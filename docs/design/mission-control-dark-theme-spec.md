# Mission Control: Dark Theme Specification

**Status: design specification only.** Dark mode is not enabled and no switcher exists. This extends [dark-mode-plan.md](dark-mode-plan.md) for the Mission Control tokens. Contrast values below are **targets that have not been measured**. Measure them with `lib/design/contrast.test.ts` before shipping anything.

## Principles

- The charcoal sidebar is the bridge between themes. It stays `#111827`, so the frame looks the same in both.
- Brand hexes do not change. Only derived foreground and soft-tint tokens are tuned.
- Dark mode is a user setting. It does not follow the OS preference silently.
- Status is never colour alone: icon and label stay in both themes.

## Token mapping

| Token | Light | Dark (proposed) | Note |
|---|---|---|---|
| `--infra-canvas` / `--background` | `#F8FAFC` | `#0B1220` | Darker than the sidebar so the sidebar still reads as a frame |
| `--surface` | `#FFFFFF` | `#111827` | Cards and panels |
| `--infra-border` | `#E2E8F0` | `#273449` | 1px borders stay the main separator |
| `--text-primary` | `#111827` | `#F8FAFC` | |
| `--text-secondary` | `#475569` | `#CBD5E1` | Target 4.5:1 on surface |
| `--text-muted` | `#64748B` | `#94A3B8` | Target 4.5:1 on surface |
| `--brand-soft` | orange 8% on white | orange 14% on surface | Insight panel wash |
| `--status-success-soft` | green 9% on white | green 16% on surface | Text uses a lighter green |
| `--status-warning-soft` | gold 14% on white | gold 16% on surface | Keep dark text on solid gold fills only |
| `--status-danger-soft` | maroon 8% on white | maroon 22% on surface | Text needs a lighter maroon tint |
| `--infra-orange-text` | `#B63D00` | `#FF9A62` | Links and codes on dark |
| `--infra-green-text` | `#166B30` | `#6FCF8A` | |
| `--infra-yellow-text` | `#6C5311` | `#F3C94D` | |
| `--infra-critical-text` | `#8C1F28` | `#F08A92` | |
| `--mc-shadow-overlay` | dark shadow | stronger shadow plus 1px border | Shadows are weak on dark, so keep the border |
| Focus ring | `#B63D00` | `#FFB48A` | Target 3:1 against adjacent colours |

## Charts

- Segment colours keep the semantic mapping (green / orange / gold / maroon / slate). Slate segments need lighter shades on dark.
- The donut track `#EEF2F6` becomes the border colour.
- Direct labels and the table equivalent remain the primary read, so no chart depends on hue alone.

## Illustrations and motif

- Motif lines use `currentColor` at the existing opacity. They need a lighter stroke on dark.
- Node fills use `var(--surface)`, so they adapt automatically.

## Implementation notes

1. Replace hard-coded values in `mission-control*.css` (`#fff`, `#f1f5f9`, `#eef2f6`, `#f8fafc`, `#64748b`) with tokens first. That is the main blocker, because these are currently literals.
2. Add the `.dark` overrides for the new tokens in `tokens.css`.
3. Add a persisted user setting and a no-flash class on `<html>`.
4. Run the contrast test on every pair above and on badge, chip and soft-tint combinations.
5. Re-check Sinhala/Tamil rendering and the browser matrix in dark.
