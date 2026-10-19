# Semantic status colors

Status styling is **visual communication only**. Server-side roles, agency scope, and resource permissions are enforced by the API — never by badge color.

## CSS token families

Each semantic category exposes background, foreground, and border variables in `tokens.css`:

| Category | Meaning | Brand anchor |
|---|---|---|
| `pending` | Awaiting action / submitted / in queue | Yellow |
| `warning` | Review required, delay, medium risk | Yellow |
| `critical` | Blocked, rejected, high/critical severity | Maroon |
| `success` | Approved, active, completed, resolved | Green |
| `neutral` | Draft, dismissed, inactive | Neutrals |
| `info` | Informational / low severity | Neutrals |
| `selected` | Active selection on canvas/lists | Orange tint |

Tailwind utilities: `bg-status-*-bg`, `text-status-*-fg`, `border-status-*-border`.

## UI components

- **Badge** variants: `pending`, `warning`, `critical`, `success`, `neutral`, `info`
- Always render **visible text** (and prefer icons in Step 19+)

## Step 16 enum → badge variant

Implemented in `semantic-colors.ts`:

| Domain | Examples |
|---|---|
| `ProjectStatus` | `UNDER_REVIEW` → pending; `APPROVED`/`ACTIVE`/`COMPLETED` → success; `CANCELLED` → critical; `ON_HOLD`/`DELAYED` → warning |
| `WorkStatus` | `SUBMITTED` → pending; `APPROVED`/`ACTIVE`/`COMPLETED` → success; `CANCELLED` → critical |
| `ConflictStatus` | Open/review paths → warning; `RESOLVED`/`CLOSED` → success |
| `ConflictSeverity` | `HIGH`/`CRITICAL` → critical; `MEDIUM` → warning; `LOW` → info |

Extend mappings when new surfaces consume additional Step 16 enums (payments, inspections, issues).

## Payment / coordination (reference)

When wired in later steps:

- `PENDING` → pending
- `REJECTED` → critical
- `APPROVED` / `PAID` / `RESOLVED` → success
