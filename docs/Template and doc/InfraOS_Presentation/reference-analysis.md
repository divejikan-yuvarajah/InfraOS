# Reference PPTX analysis — `Template.pptx` (another group's deck, Group D "SEU-AIMS")

Used as an academic reference only. No layout, wording or imagery was copied.

- 22 slides, 16:9, all on the Blank layout (so titles don't show in outline view; our deck uses title placeholders instead).
- Order: title + team → roadmap/speaker plan → problem/scope → architecture → tech stack → database → security + version control → 2 slides per member (Overview/UI/API, then Data/Logic/Tests) → testing → API testing (Postman) → deployment → contribution matrix → limitations/conclusion.
- Each member's first slide starts with "Say first: Hello, I am …, Registration Number …".
- Contribution % was estimated from git history in that deck. **We don't do that** (rule 6).

## What the reference implies the lecturer expects
Architecture, tech stack with reasons, database/ER, security + Git, two slides of depth per member, real test results, API testing evidence, deployment/setup, contribution matrix, limitations, ≤30 min, identity statements.

Gap compared with the reference: we have no Postman collection evidence. Instead we use automated API tests (Vitest + supertest-style with an in-memory MongoDB). Add Postman only if the team actually has a run.
