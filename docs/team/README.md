# INFRAOS Team Development

**Step:** 06 — Team Development & Git Strategy  
**Status:** Locked  
**Application feature code in this step:** None

This folder is the source of truth for how the INFRAOS group works in Git. Module *product* ownership remains aligned with [../architecture/team-integration.md](../architecture/team-integration.md). Product scope remains in [../planning/](../planning/README.md).

## Documents

| File | Purpose |
|------|---------|
| [git-workflow.md](./git-workflow.md) | Branches, commits, PRs, merge policy, CI gates, secrets, conflicts, Cursor/AI rules |
| [module-ownership.md](./module-ownership.md) | Who owns which module (placeholders until GitHub names are assigned) |
| [shared-files-policy.md](./shared-files-policy.md) | Files that require team-leader review |
| [code-review-checklist.md](./code-review-checklist.md) | Reviewer checklist |
| [definition-of-done.md](./definition-of-done.md) | A feature is done only after review, checks, and integration |
| [feature-handoff-template.md](./feature-handoff-template.md) | Handoff note for the integrator |
| [dependency-change-policy.md](./dependency-change-policy.md) | Adding packages, schema, and API changes |
| [release-process.md](./release-process.md) | `development` → `main`, versioning, hotfixes |

Contributor entry point: [../../CONTRIBUTING.md](../../CONTRIBUTING.md).  
Pull request template: [../../.github/pull_request_template.md](../../.github/pull_request_template.md).

## Non-goals

- Do not scaffold the monorepo here (Step 7).
- Do not implement product features.
- Do not rewrite Git history or force-push `main` / `development`.
