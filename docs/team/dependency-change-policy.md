# INFRAOS Dependency, Database, and API Change Policy

**Document:** `/docs/team/dependency-change-policy.md`  
**Step:** 06  
**Status:** Locked

Stack lock: [../architecture/dependency-rules.md](../architecture/dependency-rules.md) and ADRs. This file is the **process**. Do not add a second library for a job that is already locked.

---

## 1. Adding a package

The PR must explain:

```text
Package:
Why needed:
Alternative considered:
Security/maintenance concern:
Bundle/runtime impact:
```

Do not add:

- a second date library
- a second validation library (Zod is locked)
- a second HTTP client (browser `fetch` wrapper is locked)
- a second state library for the same job (Zustand only where needed)
- Nest, Prisma, Jest, axios-as-default, MUI/Ant as a parallel kit

Major additions (new database, UI kit, queue) need an ADR **before** merge.

Prefer MIT/Apache-2.0. Avoid Windows-hostile native addons (V1 hashing is bcryptjs).

---

## 2. Database / schema changes

Before changing a shared model:

1. Identify dependent modules.
2. Document the field change in the PR and in `/docs/database` when that folder exists.
3. Update shared types and Zod validation together.
4. Update API docs and seed/demo data.
5. Run affected tests.
6. Consider indexes (unique, 2dsphere) and existing demo documents.

Do not make breaking schema changes silently. Work requests always require `projectId` (D-009).

---

## 3. API changes

Use `/api/v1` and the locked response envelope.

Breaking changes require:

- a clear PR note
- updated docs
- updated frontend consumer
- updated tests
- a compatibility thought (avoid dual formats per member)

Do not invent a per-module error shape.

---

## 4. UI consistency (contributors)

Same design system for all modules. Nav/status colors:

```text
#FF5B00
#FEB600
#8C1F28
#279541
```

Shared typography, spacing, badges, buttons, forms, cards, tables, dialogs. No module-specific random themes.
