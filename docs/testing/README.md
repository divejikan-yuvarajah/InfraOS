# INFRAOS testing strategy (Step 2 lock)

Full product tests are created when code exists. This file records the **locked tools** so later steps do not add a second runner.

## Tools

| Layer | Tool |
|-------|------|
| Node unit + API | **Vitest** + **Supertest** |
| Frontend unit | **Vitest** |
| E2E | **Playwright** (P0 spine when UI exists) |
| AI service | **pytest** when FastAPI exists |

Do **not** add Jest or Cypress unless an ADR supersedes this.

## Priority of tests (when implementing)

1. Authn/z and IDOR (401 / 403 / 404)
2. Status-machine rejections
3. GeoJSON / date validation
4. Conflict detection helpers
5. UI loading/empty/error for critical pages

Coverage theatre is not required.

Details: [../architecture/architecture-decisions.md](../architecture/architecture-decisions.md) §8.
