# INFRAOS Definition of Done

**Document:** `/docs/team/definition-of-done.md`  
**Step:** 06  
**Status:** Locked

A feature is not done because code exists.

```text
Requirement implemented
        ↓
Architecture followed
        ↓
Validation handled
        ↓
Authorization handled (server-side)
        ↓
Responsive, accessible UI (if UI)
        ↓
Loading / empty / error / success states
        ↓
Tests updated
        ↓
Lint / type-check / build pass (when tools exist)
        ↓
Documentation updated
        ↓
PR reviewed
        ↓
Merged to development
        ↓
Integration verified
```

---

## Author checklist (before requesting review)

- [ ] Scope matches the assigned task only
- [ ] Ownership respected; shared files called out
- [ ] [feature-handoff-template.md](./feature-handoff-template.md) completed for non-trivial work
- [ ] No secrets in the branch
- [ ] Self-reviewed against [code-review-checklist.md](./code-review-checklist.md)

## Integrator checklist (after merge)

- [ ] `development` still starts
- [ ] Dependent modules still compile
- [ ] Auth still works if the change could affect it
- [ ] Smoke the related route and one neighboring route
