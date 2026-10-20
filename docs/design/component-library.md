# INFRAOS component library (Step 19)

## Location

| Layer | Path |
|---|---|
| shadcn/Radix primitives | `apps/web/src/components/ui/` |
| INFRAOS adapters | `apps/web/src/components/common/` |
| Dev verification fixture | `apps/web/src/components/examples/component-library-preview.tsx` |

## Required primitives (roadmap)

Button, Input, Textarea, Label, Select, DatePicker, Card, Badge, StatusBadge, Table, Dialog, AlertDialog, Sheet, Tabs, Alert, Tooltip, Toaster (Sonner).

## Providers

`AppProviders` wraps:

- `TooltipProvider` (focus/hover tooltips)
- `Toaster` (Sonner, light theme, `z-toast`)

## Date policy

See [component-usage.md](./component-usage.md#date-picker). Wire format: **`YYYY-MM-DD`** date-only via `apps/web/src/lib/design/date-only.ts`. Full UTC timestamps are separate API fields.

## Tokens

Use Step 17 semantic colors and Step 18 typography/spacing — no new raw brand hex in components.

## Boundaries

Not included: Step 20 forms (RHF/Zod), Step 21 data grid, Step 22 global states, Step 23 shell, backend/auth/GIS.
