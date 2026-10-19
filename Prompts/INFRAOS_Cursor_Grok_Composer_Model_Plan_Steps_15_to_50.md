# INFRAOS — Cursor Model Selection & Execution Strategy
## Steps 15–50 · Grok 4.7 vs Composer 2.5 · October 2026

**Scope:** Cursor coding assistance for INFRAOS after Step 14.  
**Project owner status:** Step 14 completed (not independently verified).  
**Available primary choices:** Grok 4.7, Composer 2.5; Grok 4.6 as fallback when Grok 4.7 isn't visible.  
**Full architectural briefing:** `INFRAOS_Cursor_Master_Project_Onboarding_After_Step_14.md`.

**Note about source terminology:** The original `Steps.docx` isn't in this workspace at generation time; task captions below reflect the previously established INFRAOS roadmap and conversation. For any exact title/status mismatch, the actual user-owned `Steps.docx` and accepted repository docs win. No original step is reordered.

---

# 1. EXECUTIVE MODEL STRATEGY

**Grok 4.7** — lead architect, risk/logic/security reviewer, complex multi-file refactors, important code involving identity/permissions/agency scope/state transitions, model/DTO compatibility and long debugging loops.

**Composer 2.5** — primary day-to-day implementation model, component authoring, styling, UI wiring, docs, safe repeatable data fixtures, routine tests and small refactors in an established pattern.

**Two-pass strategy on high-risk tasks:** Grok 4.7 audits requirements and writes a safe plan → Composer 2.5 implements well-defined submodules → Grok 4.7 reviews diff/security/architecture → required tests + final manual acceptance. Sometimes choose Grok 4.7 for both implementation and review where the risk is especially high (Step 39/45/46).

**Reasoning/plan caveat:** Cursor Plus fixes first-party models at Medium effort and standard speed. Premium and eligible legacy plans expose Grok effort `low/medium/high/xhigh`; Composer 2.5 does not offer the same Grok effort slider. If your UI cannot choose High, do not assume you've enabled it. Use the closest available model plus shorter task chunks and stronger tests.

**Avoid assuming one bigger context means zero errors.** Real repo search + targeted file reads + fresh tests are more important than pasting all 190 development prompts into a single context. For `Grok 4.7`, Cursor documents **256k standard** and optional **500k**; `Composer 2.5` **200k**. Availability and 500k pricing depend on account/mode. New projects change; check model picker and official documentation.

Official current references:

- [Cursor — Grok 4.7](https://cursor.com/docs/models/grok-4-7)
- [Cursor — Composer 2.5](https://cursor.com/docs/models/cursor-composer-2-5)
- [Cursor — Models & Pricing](https://cursor.com/docs/models-and-pricing)
- [Cursor — Project Rules](https://cursor.com/docs/rules)
- [Cursor — Plan Mode](https://cursor.com/docs/agent/plan-mode)

---

# 2. RECOMMENDATION FOR EVERY ROADMAP STEP 15–50

**Legend:**

- **G47** = Grok 4.7, excellent default for complex dependency/risk/security work. On eligible plans use **High**, **xhigh** only for hardest multi-module investigations; on Plus it runs fixed Medium.
- **C25** = Composer 2.5, recommended for focused fast interactive code changes; not controlled by Grok's effort slider.
- **Review** = recommended independent verification model. If same model is needed due to budget, use a separate fresh review session and deterministic tests.
- **Critical** = stronger tests and human acceptance required; **not** a guarantee of correctness.

| Step | Planned task | Primary model | Independent review | Complexity | Practical reasoning |
|---:|---|---|---|---|---|
| **15** | Safe synthetic demo seed architecture | **C25** | **G47** | Medium–high | Upserts, idempotency, synthetic geospatial/date fixtures and **production guard**; reviewer audits destructive-reset safety. |
| **16** | Shared TypeScript DTOs, constants and API contracts | **G47** to design; **C25** to implement | **G47** | High | Must reconcile real Step 13/14 models, wire serialization, status keys and avoid private-data leakage. |
| **17** | Official brand / accessible semantic colors | **C25** | **G47** for contrast/security review when needed | Low–medium | Use exact orange/yellow/maroon/green palette with tested foreground contrast. |
| **18** | Typography, spacing and design tokens | **C25** | **C25** fresh review | Low–medium | Existing Tailwind/shadcn-compatible tokens; prevent version drift/overengineering. |
| **19** | Reusable shadcn/Radix UI component library | **C25** | **G47** | Medium–high | Many primitives; modal/select/date/toast keyboard/focus and React boundaries merit stronger review. |
| **20** | Forms & validation UI system | **G47** plan, **C25** implement | **G47** | High | RHF + Zod types, client/server validation boundaries, date errors, async form state. |
| **21** | Advanced data tables | **G47** plan, **C25** implement | **G47** | High | TanStack table/filter/sort/page state, server pagination, permissions, slow queries. |
| **22** | Reusable loading/empty/error/success states | **C25** | **C25** | Low–medium | Small accessible state components, no invented API results. |
| **23** | Responsive authenticated application shell | **G47** plan, **C25** implement | **G47** | High | Layout/sidebar/navigation/role-aware rendering, routing/overlay stacking and mobile constraints. |
| **24** | Accessibility foundation / audit | **G47** | **G47** fresh independent session | High | Keyboard interaction, WCAG contrast, ARIA/focus and impact across components; manual tests essential. |
| **25** | Public landing navigation / header | **C25** | **C25** | Low | Reuse branding/links/components. |
| **26** | Landing hero + problem / solution presentation | **C25** | **C25** | Low–medium | Clear public narrative, responsive visuals, no fictitious claims. |
| **27** | Core feature showcase | **C25** | **C25** | Low–medium | Reuse cards/layout; present real planned modules honestly. |
| **28** | Product lifecycle / workflow sections | **C25** | **C25** | Low–medium | Storytelling of Plan → Maintain; no mock system integration. |
| **29** | Stakeholder roles, benefits, metrics content | **C25** | **C25** | Low–medium | No invented real impact statistics. |
| **30** | Marketing product/GIS preview | **G47** plan; **C25** UI | **G47** | Medium–high | Display a clearly synthetic preview without secretly implementing full Step 81 InfraMap. |
| **31** | Public supporting sections: trust/security/FAQ/CTA | **C25** | **C25** | Low | Marketing descriptions must not promise certifications/real integration. |
| **32** | Landing footer / supporting pages | **C25** | **C25** | Low | Accessibility, links, responsive layout. |
| **33** | GSAP/interaction animation | **C25** | **G47** if complex | Medium | Isolate animation and respect reduced motion/performance. |
| **34** | Public-site responsive / accessibility polish | **G47** | **G47** fresh review | Medium–high | Cross-viewport, keyboard and browser interaction QA. |
| **35** | Authentication DB/session architecture review | **G47** | **G47** separate review | Critical | Reuse Step 12 foundation; prevent duplicate or broken refresh sessions. |
| **36** | Secure user registration flow | **G47** for backend; **C25** for UI | **G47** | Critical | Input validation, account rules, password hashing, enumeration and identity constraints. |
| **37** | Email verification flow | **G47** | **G47** | Critical | Token expiry, one-time use, throttling and account-enumeration defense. |
| **38** | Login UI and client flow | **C25** | **G47** | Medium–high | Accessible forms, error boundaries, cookie model preserved; no localStorage token anti-pattern. |
| **39** | Access JWT / rotating refresh-token implementation | **G47** | **G47** independent review | **Critical** | Session rotation/reuse detection, token secrecy, HttpOnly/CORS/SameSite/HTTPS, concurrency. |
| **40** | Logout & session revocation | **G47** | **G47** | High | Current-session/all-session behavior, revocation races and refresh cookie cleanup. |
| **41** | Forgot-password request flow | **G47** | **G47** | High | Rate limits, enumeration prevention, safe token delivery. |
| **42** | Password reset & one-time token workflow | **G47** | **G47** | **Critical** | Expiring hashed single-use reset tokens and session invalidation. |
| **43** | Protected frontend routes/UX | **G47** plan; **C25** UI | **G47** | High | SSR/hydration/navigation correctness; frontend guard not authoritative. |
| **44** | Backend authentication middleware | **G47** | **G47** independent review | **Critical** | Verify JWT/session, issuer/audience, malformed tokens, consistent 401 vs 403. |
| **45** | RBAC permission engine | **G47** | **G47** independent review | **Critical** | Role/permission catalog, deny-default, no privileged bypass, tests. |
| **46** | Agency/resource scope and IDOR protection | **G47** | **G47** independent review | **Critical** | This is the most security-sensitive authorization step; enforce query/resource/assignment/state checks. |
| **47** | User profile and account settings | **C25** | **G47** for auth-sensitive paths | Medium | Self-service profile safe projections; no privilege escalation through patch payload. |
| **48** | Admin user management | **G47** | **G47** | High | Controlled create/invite/disable, scope checks, auditing. |
| **49** | Agency management | **G47** plan; **C25** straightforward UI | **G47** | High | Hierarchy/ownership/scope, no orphaned projects or uncontrolled edits. |
| **50** | Role & permission administration | **G47** | **G47** independent review | **Critical** | Prevent self-escalation, uncontrolled permission grants and invalid organization context. |

**Summary:** Use **Composer 2.5** for 15, 17–19, 22, 25–29, 31–33 and much UI implementation in 20/21/23/30/36/38/43/47/49. Use **Grok 4.7** for 16, 20–21 planning, 23–24 review, 30 planning, **35–37, 39–46, 48–50** and all high-risk architecture/security reviews.

---

# 3. PREFERRED CURSOR WORKFLOW FOR STEP 15

1. Open **Cursor Ask/Plan mode** with **Grok 4.7** and the architecture handover (read-only). Agent verifies actual Step 14 files/indexes and returns a plan.
2. Check that the full Step 15 prompt file is in `docs/prompts/` or otherwise accessible. The original file from an earlier account/session is **not automatically visible in Cursor**.
3. After human review, create `feature/step-15-seed-demo-data` from current `development`, only if safe.
4. Switch to **Composer 2.5** in Agent mode for bounded seed helpers/fixtures/verification tests **using the approved plan and full Step 15 specification**.
5. Do not connect test seed scripts to production. Require explicit safe env guards and isolated dev/test URI name checks; no `dropDatabase()` and no broad `deleteMany({})`.
6. Run seed once, run again to prove idempotency, verify records and RoadSync positive/negative location-date fixtures; reset/reseed only on an explicitly safe disposable environment.
7. Use **Grok 4.7** for a read-only independent final review of seed code and Git diff, especially script safety and relations.
8. Report PASS/FAIL/NOT RUN; do not commit/push/merge without explicit approval. PR goes to `development`, not direct `main`.

**When you have only one model allowance available**, prioritize Grok 4.7 review for destructive DB/authorization sensitive changes and let Composer handle smaller well-specified implementation tasks.

---

# 4. HOW TO REDUCE TOKEN / USAGE SPEND WITHOUT LOWERING QUALITY

- Save **one concise project rules file** (`AGENTS.md` or a `.cursor/rules/*.mdc` project rule) summarizing immutable architecture constraints, module ownership, Git policy and step gating. Store long detailed background in `/docs/architecture`, not repeated in every agent turn.
- Before each step, send **only that step's specification**, direct docs paths, relevant schema/API files and last-step report. Do **not** paste 190 step prompts into every chat.
- Run orientation in a fresh conversation, then another fresh conversation for each major step after approved checkpoint.
- Use `Plan Mode` for security/auth/DTO/complex layout changes; use `Agent` for bounded implementation.
- Split implementation by reviewable file/module boundaries. On a larger Step 19/20/21, use 3–5 sub-batches, not one all-or-nothing request.
- Stop and summarize progress in a short `docs/progress/step-XX-handoff.md` when context is getting long, then begin new session with that checkpoint.
- Do not run build/test 10 times after unrelated edits; run targeted checks after a batch and broad check before handoff.
- Never use token conservation as an excuse to skip a deterministic test, auth test, data integrity check, or end-to-end review.
- If a model stalls, don't endlessly retry the same prompt. Inspect logs, use narrower failing tests, then switch from Composer to Grok for root-cause analysis.

**Effective reasoning target by work (only if the user's plan exposes it):**

```text
Composer 2.5 (standard): defaults for UI/components/docs/fixtures.
Grok 4.7 Medium: general codebase analysis and medium-complex tasks.
Grok 4.7 High: multi-module architecture, DB contracts, auth/RBAC review.
Grok 4.7 xhigh: exceptional, tightly scoped security or thorny dependency investigation.
```

Cursor Plus first-party Grok effort is fixed at **Medium**. Requesting high/xhigh in a prompt does not override a locked account setting.

---

# 5. CURSOR PROMPT TO SELECT MODEL AND PLAN A SPECIFIC STEP

Paste this after the master onboarding session and before executing a step:

```text
Task: INFRAOS Step <NUMBER> — <EXACT ROADMAP TITLE>.

Read my saved INFRAOS master architecture briefing, repository rules, the full approved Step <NUMBER> development prompt, and current integration branch state. Use the accepted repo/codebase as evidence rather than assuming planning docs have been implemented. Confirm previous-step dependencies, including Step 14 MongoDB/GeoJSON indexes.

Recommend whether this step should use Composer 2.5 or Grok 4.7 for planning, implementation and independent review, using the Steps 15–50 model plan. Explain the major risks in no more than six bullets. Then give a short file-by-file implementation plan, target branch from development, required tests and exact stopping gate.

Do NOT edit files, run destructive DB scripts, commit, push or merge yet. Wait for my approval.
```

---

# 6. CURSOR EXECUTION INSTRUCTION TEMPLATE FOR EACH STEP

```text
Execute ONLY INFRAOS Step <NUMBER> from its full approved Markdown specification. Follow project rules, accepted architecture, and previous-step completion requirements.

1. Pre-review repo, Git status, actual relevant files, model/API/status conventions and tests. Preserve teammates' changes.
2. On approval, create/check out a step-specific feature branch from current development if safe.
3. Implement only the requested step in small, testable sub-batches; use the intended Cursor model according to the model plan.
4. Run focused tests, lint, typecheck, relevant build and any required safe integration test. Never use production DB.
5. Perform code/security/UX/a11y review appropriate to step, fix all newly introduced issues, rerun checks.
6. Review git diff/status, include untracked files, update docs and produce complete final step report.
7. Prepare suggested commit and PR to development; do not commit/push/merge without my approval.
8. Stop after current step. Do not start the next roadmap step.
```

---

# 7. MODEL LIMITS / PRICING / PLAN REALITIES

**From Cursor's official documentation viewed in October 2026 (may change):**

| Model | Standard context | Optional extended context | Pricing beyond included pool, standard tier |
|---|---:|---:|---|
| Composer 2.5 | 200k | No extended window specified | $0.50 / million input; $2.50 / million output |
| Grok 4.7 | 256k | 500k (at higher long-context pricing) | $2 / million input; $6 / million output |

These are *list prices for additional usage*, not guarantees that your specific subscription is billed per token for every request. Your Cursor usage pool differs by account tier; inspect **Cursor Settings → Usage** and the model selector. At standard input prices Grok is roughly 4x Composer; output ~2.4x, before caching/variants. Grok's long-context mode and Fast tier are more expensive. Context limit doesn't eliminate compaction or authorization risks.

On **Cursor Plus**, supported first-party models include Grok 4.7, Grok 4.6, Grok 4.5 and Composer 2.5, but Grok effort is fixed to Medium (not selectable High/xhigh) and Fast is unavailable. **Premium and eligible legacy subscriptions** may expose effort options; the user has not specified which Cursor plan they hold.

**Don't select a model solely because a benchmark number is larger.** Model outputs still require human review for privileged access, identity sessions, database reset scripts, accessibility and production deployments.

---

# 8. FINAL SAFETY CHECKLIST

- [ ] Step 14 code and indexes verified before beginning Step 15.
- [ ] Full Step 15 specification actually exists in Cursor workspace.
- [ ] Correct branch from up-to-date `development`, with no overwriting teammate work.
- [ ] Synthetic data only, no fake official integrations/credentials.
- [ ] Grok selected for risk review; Composer chosen for routine implementation.
- [ ] Required secure database guards and isolated test DB confirmed.
- [ ] Every step has pre-review + post-review + fix/retest and final evidence.
- [ ] Never auto-commit/push/merge to `development` or `main` without approval.
- [ ] Follow 190-step roadmap; stop between steps.

**Next action:** First run the **architecture onboarding prompt** in Ask/Plan (no edits). After reviewing the handover, execute **Step 15** only.
