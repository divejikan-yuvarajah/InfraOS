# Component usage (Step 19)

## Imports

```tsx
import { Button } from "@/components/ui/button";
import { ProjectStatusBadge } from "@/components/common/status-badge";
import { DatePicker } from "@/components/common/date-picker";
```

## Button

- Primary uses `--primary` / `--primary-foreground` (dark text on orange).
- `loading` sets `aria-busy`, disables interaction, shows spinner.
- Icon-only: **required** `aria-label`.

## StatusBadge

Always shows **text label**; maps Step 16 enums via `semantic-colors.ts` (visual only, not authorization).

```tsx
<ProjectStatusBadge status="UNDER_REVIEW" />
```

## Date picker

- **Wire value:** `YYYY-MM-DD` (`DateOnlyString`).
- **Display:** locale `toLocaleDateString`.
- **Do not** treat date-only as UTC midnight for API payloads.
- Optional `fromDate` / `toDate` for disabled ranges — not business rules.

## Toast

Fire from explicit user actions only. Never toast backend success without a verified response (Step 20+).

## Table

Use base `Table*` primitives. Horizontal scroll is on `Table` wrapper. Step 21 adds TanStack/sort/filter.

## Anti-patterns

- White body text on raw `#FF5B00` / `#279541`.
- Status communicated by color alone.
- `window.confirm` for production destructive flows (use `AlertDialog`).
- Importing Express/Mongoose into `components/ui/*`.
