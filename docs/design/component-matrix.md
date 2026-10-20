# Component matrix (Step 19)

| Component | Source | File | Variants / notes | Tests |
|---|---|---|---|---|
| Button | shadcn + loading | `ui/button.tsx` | default, secondary, outline, ghost, destructive, link; sizes; `loading` | manual + preview |
| Input | shadcn | `ui/input.tsx` | native types, `aria-invalid` | preview |
| Textarea | shadcn | `ui/textarea.tsx` | — | preview |
| Label | shadcn | `ui/label.tsx` | associates controls | preview |
| Select | Radix | `ui/select.tsx` | keyboard, portal | preview |
| DatePicker | Calendar+Popover | `common/date-picker.tsx` | date-only `YYYY-MM-DD` | `date-only.test.ts` |
| Card | shadcn | `ui/card.tsx` | slots | preview |
| Badge | shadcn + status | `ui/badge.tsx` | pending/warning/critical/success/… | contrast (Step 17) |
| StatusBadge | adapter | `common/status-badge.tsx` | Step 16 enum → variant | semantic-colors |
| Table | shadcn | `ui/table.tsx` | semantic `<table>` | preview |
| Dialog | Radix | `ui/dialog.tsx` | focus trap | preview |
| AlertDialog | Radix | `ui/alert-dialog.tsx` | destructive confirm | preview |
| Sheet | Radix | `ui/sheet.tsx` | drawer | preview |
| Tabs | Radix | `ui/tabs.tsx` | keyboard | preview |
| Alert | shadcn + semantic | `ui/alert.tsx` | default, warning, success, destructive | preview |
| Tooltip | Radix | `ui/tooltip.tsx` | provider in AppProviders | preview |
| Toast | Sonner | `ui/sonner.tsx` | explicit trigger only | preview |

Future consumers: Step 20 forms, Step 21 tables, ProjectTrace/RoadSync modules.
