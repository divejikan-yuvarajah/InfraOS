# Shared contracts

**Step:** 16  
**Package:** `@infraos/shared-types`

```text
Mongoose documents (apps/api only)
        ↓ later mappers
Authenticated DTOs and public DTOs (this package)
        ↓
REST JSON /api/v1
```

| Layer | Location | Browser |
|---|---|---|
| Persistence | `apps/api` models | No |
| Wire DTO | `@infraos/shared-types` | After the server authorizes the response |
| Public DTO | `PublicProjectDto`, `CitizenIssueReceiptDto` | Approved fields only |

A TypeScript type is not an authorization check.

JSON rules:

- IDs are strings.
- Timestamps are ISO-8601 UTC strings.
- Money is `{ amountMinor, currency: "LKR" }`.
- Scores are 0–100.
- Distance is metres.
- GeoJSON is longitude, latitude. Point, LineString, Polygon only.
- Schedule overlap is inclusive: `A.start <= B.end AND A.end >= B.start`.
- `PATCH` omitted fields are unchanged. `null` clears only nullable fields.

Domain status arrays match Step 13 module constants. Drift is tested in `apps/api/tests/contracts.shared.test.ts`. Models still own their local arrays until a later step imports the shared constants.

Changing a shared contract: update types, docs, drift tests, then web and API type-check. Breaking changes need a migration note and Team Leader review.
