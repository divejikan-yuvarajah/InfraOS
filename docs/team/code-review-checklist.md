# INFRAOS Code Review Checklist

**Document:** `/docs/team/code-review-checklist.md`  
**Step:** 06  
**Status:** Locked

Reviewers use this list. Authors should self-review against it before requesting review.

Team leader extra focus: shared architecture, integration, API consistency, DB naming, auth/RBAC, secrets, navigation, CI, deploy. Do not rewrite the author’s module without cause.

---

## Functionality

- [ ] Stated requirement is implemented (not a lookalike)
- [ ] Realistic edge cases handled (invalid id, empty list, stale status, missing related object)
- [ ] Workflow matches locked lifecycle / RoadSync / ProjectTrace rules
- [ ] No unrelated drive-by changes

## Architecture

- [ ] Module boundary respected ([../architecture/module-boundaries.md](../architecture/module-boundaries.md))
- [ ] No duplicate service, API client, or auth stack
- [ ] No circular dependency
- [ ] Shared-file edits are justified and smallest possible
- [ ] Locked stack only (no Nest/Prisma/Jest/second HTTP client)

## Security

- [ ] Backend authentication on protected routes
- [ ] RBAC + resource-level authorization (not UI-only)
- [ ] IDOR: private missing resources 404, capability failure 403
- [ ] Validation on the server (Zod)
- [ ] No secrets, `.env`, or credentials in the diff
- [ ] File download/upload ACL preserved
- [ ] AI inputs treated as untrusted; P0 does not require FastAPI
- [ ] SoD preserved (submit ≠ approve; contractor never verifies/pays; Super Admin not operational approver)

## Database

- [ ] Indexes considered (including 2dsphere where GeoJSON is queried)
- [ ] References / required `projectId` on work requests
- [ ] Seed/demo impact documented
- [ ] No silent breaking schema change

## API

- [ ] `/api/v1` envelope consistent
- [ ] Status codes and errors match platform rules
- [ ] Breaking changes called out with consumer + test updates

## UI

- [ ] Flag-inspired palette for nav/status; no random theme
- [ ] Responsive (mobile through large desktop) — not a shrunk desktop
- [ ] Accessible: labels, keyboard, focus, contrast, errors
- [ ] Loading, empty, error, and success states
- [ ] Role-aware chrome matches [../ux/navigation-by-role.md](../ux/navigation-by-role.md)

## Testing

- [ ] Relevant unit / API / UI tests added or updated
- [ ] Unauthorized / forbidden / missing-resource cases where the change is an API
- [ ] Lint, type-check, tests, and build run (when available)

## Documentation

- [ ] API / architecture / UX / security docs updated if contracts changed
- [ ] Handoff note filled for non-trivial features

## Merge hygiene

- [ ] `git status` / diff reviewed
- [ ] No debug noise, generated junk, or accidental files
- [ ] Conflicts resolved with both intents preserved
