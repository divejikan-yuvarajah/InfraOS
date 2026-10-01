# INFRAOS Release Process

**Document:** `/docs/team/release-process.md`  
**Step:** 06  
**Status:** Locked

---

## 1. Flow

```text
Feature branches
        ↓
development          (integration)
        ↓
Integration / QA
        ↓
main                 (production / submission)
        ↓
Demo / evaluator / GitHub
```

Do not treat `main` as a playground.

---

## 2. Versioning (academic, simple)

Do not tag a release for every commit. Suggested milestones:

| Version | Meaning |
|---------|---------|
| v0.1.0 | Foundation (workspace, lint, env examples) |
| v0.2.0 | Authentication / identity |
| v0.3.0 | ProjectTrace |
| v0.4.0 | RoadSync |
| v0.5.0 | InfraMap |
| v0.6.0 | Supporting modules (finance, docs, citizen as in scope) |
| v0.7.0 | AI (optional path) |
| v0.9.0 | Release candidate |
| v1.0.0 | Final submission |

Use GitHub Releases / tags only at these meaningful points (team leader).

---

## 3. Promoting `development` to `main`

1. `development` is green: lint, type-check, tests, build (when they exist).
2. Smoke P0 path (or current implemented slice).
3. Open a PR `development` → `main` with a short changelog.
4. Team leader reviews integration and security-sensitive diffs.
5. Merge. Tag if it matches a version milestone.

---

## 4. Hotfix

Only for a critical bug already on `main` (broken demo, auth outage, leaked pattern that must be patched).

```text
main
  → fix/<issue>
  → review / test
  → merge to main
  → merge or cherry-pick back to development
```

Do not hotfix from a stale feature branch. Do not skip review unless the team leader documents an emergency and follows up immediately.

---

## 5. Environments

| Env | Git | Host (locked intent) |
|-----|-----|----------------------|
| Local | feature branch | developer machines |
| Integration | `development` | optional preview later |
| Submission | `main` | Vercel (web) + Render (API/AI) |

Never put production secrets in the repo. Deploy config may exist; values stay in the host’s secret store.
