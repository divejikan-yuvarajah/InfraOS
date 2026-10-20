# Component accessibility (Step 19)

## Contrast

Reuse Step 17 verified pairs ([color-accessibility.md](./color-accessibility.md)). Primary buttons use `#111827` on orange. Alerts/badges use tinted surfaces + derived foregrounds.

## Keyboard

| Component | Expectation |
|---|---|
| Button | Focus ring; disabled/loading not activatable |
| Select | Open, arrows, typeahead, Esc |
| DatePicker | Trigger + calendar grid navigation |
| Dialog / AlertDialog | Focus trap, Esc, restore focus |
| Sheet | Esc, scroll, close control |
| Tabs | Arrow keys between triggers |
| Tooltip | Focus + hover; not sole label for icon buttons |

## Status

Every `StatusBadge` and semantic `Alert` includes visible **title/text**. Icons supplement, not replace.

## Motion

`prefers-reduced-motion` respected globally (Step 18). Avoid motion-only disclosure.

## Testing

Automated: `contrast.test.ts`, `date-only.test.ts`. Browser keyboard/responsive QA: run manually on foundation preview (see [step-19-review.md](./step-19-review.md)).
