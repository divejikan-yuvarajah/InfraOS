# INFRAOS — Complete Enhanced Development Prompt
## Phase 3 · Step 20 — Forms & Validation UI System

**Project:** INFRAOS — National Infrastructure Intelligence & Coordination Platform  
**Vision:** *The Operating System for National Infrastructure*  
**Core lifecycle:** Plan → Coordinate → Approve → Build → Verify → Monitor → Complete → Maintain  
**Development roadmap:** Step **20 only** of 190; Phase 3 (UI/UX Design System)  
**Execution role:** Principal Next.js/React/TypeScript UI Platform Engineer, React Hook Form + Zod Specialist, Accessibility Engineer, API-Contract Integrator, Security Reviewer, QA Engineer and Git/Team Integration Lead  
**Implementation branch:** `feature/step-20-forms-validation-ui`  
**PR target:** `development` after explicit team review/approval; `main` only at separately approved stable release checkpoint  
**Companion:** `INFRAOS_Cursor_Codex_Execution_Step_20.md`

> **Source status:** This prompt follows the previously approved 190-step group plan and user-confirmed *Step 20 — Forms & Validation UI System*. The original `Steps.docx` is not attached to this output session, so do not pretend to quote its exact sub-bullets. When actually running this step, inspect the repository's original roadmap and approved ADRs. Resolve contradictions with implemented, approved code rather than silently changing schemas. The previous Cursor read-only report verified `development` at `239671f` through Step 14 **at that earlier time**, not Steps 15–19. **Do not assume Step 19 is done merely because the Step 19 prompt was generated.**

---

# 0. Non-negotiable operating instructions

Read **this entire document** before changing files. Your assignment is to establish a reusable, strongly typed, accessible **form composition + validation foundation** using the **existing shadcn/Radix UI primitives from Step 19**, **React Hook Form (RHF)** and **Zod**. The outcome must be ready for future ProjectTrace, RoadSync, agency, finance, document, inspection and citizen workflows; it is **not** authorization to build those feature forms or their APIs now.

**Strict execution:** pre-implementation audit → dependency/branch verification → plan → implement in small batches → focused tests → integration/regression tests → accessibility/security review → fix/retest → diff/untracked review → documentation → approved Git handoff → STOP.

Do **not**:

- Begin if Step 19 has not been reviewed and integrated into the chosen `development` baseline; report blocker instead.
- Reset, stash, force checkout, delete branches or change uncommitted teammates' work.
- Auto-commit, push, open/merge a PR, or update `main` without explicit authorization.
- Add new Express endpoints, MongoDB models/indexes, auth/JWT, real upload storage, RoadSync detection, maps, AI/RAG or full application workflows as part of a UI form infrastructure step.
- Create a second design-token palette or parallel form library.
- Reproduce backend role/permission decisions solely in client-side validators, or assume client-side Zod validation secures the backend.
- Report tests/build/visual checks as passed unless actually executed; never hide failures by deleting tests or disabling ESLint/TypeScript.

---

# 1. INFRAOS domain, stack and architectural context

INFRAOS is a university full-stack GovTech platform inspired by Sri Lankan national infrastructure workflows; no claim of official government deployment. Its differentiator is **RoadSync**, deterministic geospatial and schedule overlap coordination across agencies. Primary modules include Platform/Identity, ProjectTrace, RoadSync, InfraMap, AI Risk, DocTrace/RAG, Finance/Contractors, Inspections, Assets/Maintenance, Citizen Portal/Issues, Notifications, Reports and Audit.

Approved runtime architecture, **subject to actual code/version inspection**:

```text
apps/web                   Next.js App Router / React / TypeScript
                           Tailwind CSS / shadcn/ui / Radix
                           React Hook Form / Zod / TanStack Query
                           MapLibre later
           HTTPS REST /api/v1 (actual API contracts per Step 16)
apps/api                   Node.js / Express / TypeScript / Zod / Mongoose
packages/shared-types      safe serializable DTOs, identity/permission catalogs
MongoDB Atlas              Mongoose models, GeoJSON, 2dsphere indexes
apps/ai (later)            FastAPI risk / extraction / RAG
```

**Previously observed repo state (historical, not current verification):** Next.js 16.3.8, React 19, Express 5, Mongoose 8, typed REST envelope `{success, data, meta.requestId}`, only health/readiness API routes at Step 14. Check the real versions/endpoints after Steps 15–19; do not assume all still hold. Frontend may already have partial forms or relevant primitives—reuse them.

**Product design:** professional light-first enterprise/GIS interface, calm surfaces and high readability. Exact approved raw colors:

| Purpose | Color |
|---|---|
| Brand orange | `#FF5B00` |
| Pending/warning yellow | `#FEB600` |
| Critical/conflict maroon | `#8C1F28` |
| Healthy/approved green | `#279541` |
| Canvas | `#F8FAFC` |
| Surface | `#FFFFFF` |
| Primary text | `#111827` |
| Secondary text | `#475569` |
| Muted text | `#64748B` |
| Border | `#E2E8F0` |

Use **approved Step 17–18 semantic tokens** for accessible text/borders/focus and form feedback. Raw orange, yellow and green swatches must not automatically be used as low-contrast text. Avoid inventing a revised brand.

---

# 2. Prerequisites and dependency gate

For Step 20 to proceed, verify **in actual repository code/history**, not generated prompts:

| Step | Required implemented input | Why |
|---|---|---|
| 16 | Shared DTOs, statuses, API error and response contracts (or accurate evidence they remain pending) | Typed future transport boundaries; no invented schemas |
| 17 | Semantic brand colors / safe accessible foregrounds | Field invalid, warning, success, focus UI |
| 18 | Typography, spacing, radius, motion, focus tokens | Consistent field layout and help/error spacing |
| 19 | Working Button, Input, Textarea, Label, Select, DatePicker, Card, Dialog, Alert, Toast primitives as applicable | Form infrastructure composes primitives; avoid duplication |

**Hard prerequisite:** If Step 19 is not complete/approved/in `development`, return `BLOCKED` and do not make Step 20 implementation edits. If Step 16 statuses are not yet available, do not invent them; explain the upstream gap.

Inspect the installed RHF and Zod versions (including `@hookform/resolvers`), React 19/Next server-client boundaries, alias resolution, path conventions, test runner and existing client components. If a package is not installed, check lockfile and workspace conventions before proposing addition. Avoid globally upgrading dependencies.

### Pre-implementation report (deliver before editing)

```text
STEP 20 PRE-IMPLEMENTATION REVIEW
Current branch / commit / remotes / tracking refs:
Working tree (tracked, staged, untracked and ownership risks):
Step 19 PR/commit/merge evidence in development:
Steps 16–18 dependencies verified (files/exports):
Installed Next/React/RHF/Zod/resolvers/shadcn versions:
Existing form components and duplicate abstractions:
Existing input/select/date-picker prop contracts:
Current error-envelope/API contract implementation:
Existing component tests and CI scripts:
Known baseline lint / typecheck / tests / build results:
Sensitive data / business logic boundaries:
Proposed files and implementation order:
Potential conflicts and planned safeguards:
Decision: READY / BLOCKED / limited read-only assessment:
```

**Pre-review test baseline:** run actual available scripts on a safe read-only workspace before implementation; label missing/unexecuted checks, don't claim they passed.

---

# 3. Safe Git branching and integration

1. Record `git status --short`, `git branch --show-current`, `git remote -v`, `git log -1 --oneline`, and the actual base/remote status.
2. Inspect every untracked `Prompts/` document before staging. Earlier reports found **five untracked prompt files**—do not assume they are still present and never add them accidentally.
3. Confirm Step 19 integrated on `development`. If no safe branch switch is possible due to dirty work, stop.
4. With authorization for normal Git branch operations and correct remote, use equivalents of:

```bash
git switch development
git pull --ff-only origin development
git switch -c feature/step-20-forms-validation-ui
```

5. If a branch already exists, inspect commit lineage and ask how to proceed—no blind recreation/reset.
6. Keep commits scoped to reviewed Step 20 files; **commit/push/PR/merge require separate explicit user approval**. Prepare message `feat(ui): add typed accessible form and validation foundation`.
7. Review and merge to `development` only through the approved team PR procedure. After merge, rerun affected checks. Only promote `development` to `main` at separately approved stable phase/release checkpoints (normally after Steps 17–24 are verified), never automatically at Step 20.

---

# 4. Scope and definition of the deliverable

**Build a reusable, accessible, strongly typed form system—not individual application forms.**

**In scope:**

- RHF + Zod resolver setup consistent with installed versions.
- Typed form field primitives and composable shadcn `Form` layer, including Controller/field adapters as required.
- Consistent labels, descriptions, validation errors, required indicators, ARIA wiring, fieldset/group semantics.
- Native Input/Textarea and controlled Select, DatePicker, Checkbox/Switch where actually present or needed.
- Form-level submission component/submit-state pattern using existing Button and optional toast/alert.
- Clean default values and reset/cancel/edit/populate patterns; normalized blank/error behaviors.
- Schema boundary for form inputs → validated/transformed outputs → future API DTO; explicit client/server trust boundary.
- Server field-error mapping into RHF, including summary/non-field errors without bypassing validation.
- Typed reusable examples *with synthetic data* and focused test coverage.
- Documentation and integration guidance for ProjectTrace/RoadSync future forms.

**Out of scope:**

- Step 21 advanced server-side TanStack Data Table.
- Step 22 full-page loading/empty/success/error state design system.
- Step 23 role-aware authenticated application shell.
- Step 24 global a11y audit (perform **within-step** a11y review nonetheless).
- Registration/login and password-reset flows (Steps 35–42).
- Admin user/agency screens, roles or permissions (Steps 48–50).
- Project creation, work request/conflict coordination, GIS editor, payments, documents, citizen issue submission.
- Express controllers, database validation changes, auth, server permissions, uploads, file storage, live government APIs or AI.
- New global design framework, form wizard engine or generic schema-to-UI generator.

---

# 5. Recommended module structure (inspect before using)

Prefer extending the existing shadcn Form primitives rather than creating a second form package. Example structure only:

```text
apps/web/src/components/ui/form.tsx       # existing shadcn-compatible Form group
apps/web/src/components/ui/label.tsx      # already from Step 19 if present
apps/web/src/components/forms/
  form-field.tsx                          # only thin justified wrappers
  text-field.tsx                          # optional compositional helper
  textarea-field.tsx
  select-field.tsx
  date-field.tsx
  checkbox-field.tsx                       # only if needed
  form-actions.tsx                         # submit/reset with explicit behavior
  form-error-summary.tsx                   # error focus and global status
apps/web/src/lib/forms/
  errors.ts                                # pure mapping from parsed server errors
  normalizers.ts                           # pure, cautious input/DTO transformations
  types.ts                                 # local portable form types, no backend secret imports
apps/web/src/__tests__/forms/              # use actual project test convention
apps/web/src/app/...                       # OPTIONAL dev-only harness, production gated

docs/design/forms-and-validation.md
docs/design/forms-a11y.md
docs/architecture/form-data-contracts.md
docs/testing/step-20-form-test-matrix.md
docs/reviews/step-20-post-implementation.md
```

**Rules:** single ownership/source of truth for primitives; avoid many near-identical wrappers, giant barrels, leaking UI-only code into `packages/shared-types`, circular dependencies or marking entire App Router segments `"use client"`. Only interactive form components and provider boundaries should be client components. Keep schema helpers pure and testable where possible. Do not import Mongoose, Express or Node secrets into client bundles.

---

# 6. React Hook Form + Zod integration requirements

## 6.1 Version-specific discovery

Inspect installed major versions of:

```text
react-hook-form
zod
@hookform/resolvers
react
next
@radix-ui/* / shadcn generator output
```

Resolve known version-dependent type mismatches empirically rather than pasting a copied example from a different Zod version. **Zod v4 and resolver version combinations differ**; pin/respect project lockfile. Do not install an unnecessary alternate validation library.

## 6.2 Typed schema contract

A reusable integration should support:

```text
raw browser form values
  → RHF input state (z.input<TSchema>)
  → Zod parse/transform/refinements
  → trusted-for-format (NOT trusted-for-security) parsed values (z.output<TSchema>)
  → explicit DTO mapping
  → future API call (NOT created in Step 20)
  → server validation + authorization (in future feature steps)
```

When Zod transforms/coercion alter input vs output types, use correct RHF generics (`useForm<Input, Context, Output>` where supported), resolver and `handleSubmit` types. Do not type `z.infer<T>` everywhere if raw inputs are strings and parsed outputs are numbers/dates.

Use `mode: "onBlur"` or another consistent documented policy for usability. Avoid expensive validation on every keystroke in large future forms without reason. `reValidateMode`, `criteriaMode`, native required attributes and `shouldFocusError` must be deliberate/documented choices, not magic defaults inferred as always appropriate.

## 6.3 Schema design conventions

- **Separate schemas per use case** where future features need their own business rules, not one mega `AnyProjectFormSchema`.
- Use composable primitives for trimming, empty-to-undefined, valid email formats, bounded strings, positive/nonnegative numbers, constrained enums from contracts, date-only string checking and optional array items.
- Specify required vs optional vs nullable vs blank input explicitly. `""`, `undefined`, `null`, empty array and omitted property are not interchangeable.
- Prefer Zod discriminated unions for real conditional form structures only when justified.
- Min/max length with actionable error copy, not implementation jargon.
- Async checks for uniqueness/authorization are **server-side**; never claim synchronous client schema can guarantee them.
- Dates and numbers require explicit localized human-input handling; do not rely on permissive JavaScript `Number()`/`Date.parse()` behavior for financial or schedule values.
- Avoid indiscriminate `z.coerce.number()` on blank strings (can coerce empty to zero); treat empty separately and explicitly.
- Avoid silently defaulting missing required fields, especially approval, budget, location, role/agency, and safety-critical values.
- Client schemas enhance UX only; later Express/Zod validators remain the enforcement source; keep behavior aligned but do not rewrite existing backend schemas in Step 20.

## 6.4 Domain-specific future compatibility rules (not form features)

Prepare the **contract guidance** for:

| Domain | Validation considerations | Not implemented in Step 20 |
|---|---|---|
| ProjectTrace project | Project code `INF-[A-Z_]+-[0-9]+`, valid status, agency assignment, realistic date chronology | Actual project create/edit API/form |
| RoadSync work request | Planned start/end, work type/status, GeoJSON lon/lat, no invented conflict results | GIS editor and conflict detection |
| Finance | Nonnegative **integer LKR minor units**, no floating-point payment authority | Payment approval and budget forms |
| Citizen issue | Public/privacy-safe text, location, evidence optional with upload safety | Citizen issue endpoint |
| Identity | Current `GOV_ADMIN` key, enum-matched roles; backend agency/resource permissions | Login/registration/RBAC |
| Documents | Descriptive metadata and display errors only | R2 upload, extraction, RAG |

**Do not generate sample demo users with passwords or fake authenticated API calls.** If a DTO is not in actual Step 16 exports, keep any showcase local instead of fabricating a public contract.

---

# 7. Form UI primitives and composition patterns

## 7.1 `Form` / `FormField` / `FormItem` / `FormControl`

Implement/normalize a version-compatible shadcn/RHF layer with:

- RHF `FormProvider`/context where needed, `Controller` or supported `useController` adapters.
- `FormField` providing stable label/description/message relationships across nested fields, with unique IDs generated via React conventions (`useId` where appropriate).
- `FormItem` supporting field spacing and state without bypassing global design tokens.
- `FormControl` **preserving forwarded ARIA attributes and refs** to the underlying actual focusable element, including Radix triggers. Be wary of `asChild` ref/prop collisions.
- `FormLabel` connected via `htmlFor` and `id` to the *real* input/trigger; required vs optional marker and screen-reader context.
- `FormDescription` explaining expected format without relying only on placeholder.
- `FormMessage` rendering the right error for the active field in accessible text, not a raw Zod stack.
- Native HTML semantics intact; no div with `onClick` impersonating form controls.

If Step 19 already provided a complete, tested `components/ui/form.tsx`, **reuse and enhance** only missing behavior; avoid unnecessary regeneration.

## 7.2 `TextField`/`TextareaField`

Document or implement thin convenience composition for repeated labeling, description, errors and controls when helpful. Support:

- `name` typed to RHF field path when wrappers are generic.
- `autoComplete`, `type`, `readOnly`, `disabled`, `required`, maxLength, `aria-invalid`, `aria-describedby`.
- Long project/agency names; character limit helper only if needed and accurate.
- No default logging of input; password fields use secure native types and no copy-to-logs.
- Do not hardcode project schemas in shared fields.
- Character counters must correctly track Unicode/code points if offered; avoid claiming grapheme-correctness without library support.

## 7.3 Controlled `Select`

- Bind `value`/`onValueChange` with `Controller` to existing Step 19 Radix Select.
- Provide `onBlur` where supported and correct `ref` to actual focusable trigger, not hidden input.
- Handle placeholder/undefined/empty selection explicitly; don't send display labels as domain IDs.
- Preserve accessible name, error/help `aria-describedby`, disabled state, list keyboard navigation and focus.
- Support long agency names and options without overflow.
- **No async agency fetch/authorization** in this step.

## 7.4 Controlled `DatePicker`

- Reuse Step 19 date-picker/calendar; do not install a second calendar system.
- Define date-only input wire format (recommended `YYYY-MM-DD`) distinct from UTC instants; do not shift dates by timezone conversions.
- Document empty value, min/max if supported, input typing/localization, keyboard focus, selected/clear and disabled behavior.
- Distinguish `start <= end` rules in feature schema from generic calendar primitive; demo schema can illustrate cross-field refinement but no real ProjectTrace save.
- Calendar popover focus, close and error announcements must work without trapped keyboard.
- Do not use `new Date("YYYY-MM-DD")` as a blindly local date or serialize calendar-only values with `.toISOString()` without checking timezone semantics.

## 7.5 Checkbox / Switch / Radio group

Only if already approved Step 19 components or needed for demonstrative completeness. For RHF adapters:

- Boolean `checked` / `onCheckedChange` mapping, no `'on'` string leakage.
- Grouped checkbox arrays as explicit arrays, no stale mutable references.
- Label, `fieldset`/`legend` for related choices; documented read-only/disabled.
- Error messages and selection state not color-only.
- No terms/permissions grants simulated as real server authority.

## 7.6 Repeatable/conditional field support

Demonstrate **minimal patterns** for `useFieldArray` and conditional sections in tests/docs (e.g. two hypothetical milestones, optional alternate contact), but **do not** build a generic form builder or full multi-step wizard in Step 20. Prefer examples over new abstraction when requirements are not proven.

Correctly preserve stable field IDs, error paths, value retention policy (`shouldUnregister` decision) and initial arrays; no index-keyed form row bugs.

---

# 8. Form lifecycle, submissions and state UX

## 8.1 Required states

Ensure reusable patterns for:

```text
pristine / untouched
editing / dirty
validating (if async future support)
invalid client fields
submitting
submitted successfully (from explicit successful callback only)
server field-error result
server general-error result
network/timeout/unknown error
cancel / reset / restore defaults
```

Implement state using RHF built-in `formState` (`isDirty`, `isValid`, `isSubmitting`, `isSubmitSuccessful`, `errors`, etc.) as supported; **do not duplicate this wholesale in Zustand or global app state**. Submit buttons should disable/restrict repeat clicks while submitting. Distinguish `isSubmitting` from server acceptance.

## 8.2 Async submission contract

- The shared UI layer can accept an **injected asynchronous `onSubmit` callback** or pattern, not hardcode a network request.
- Only call `reset()` after the future API truly succeeds, if the intended UX warrants it; otherwise preserve user input for correction.
- Do not show success toast upon click or when promise is pending.
- Avoid `void`ing promise rejections, swallowed errors or unnecessary auto-retry on non-idempotent POST operations.
- Explicitly handle unexpected errors with non-sensitive copy, optional `meta.requestId` correlation if provided by actual server response.
- Allow a user to cancel a form safely; closing a dirty modal must be a deliberate future feature decision, not a global auto-discard.
- Keep a11y `aria-busy`, button labels and live regions appropriate; do not hide all fields on error.

## 8.3 Reset/edit/hydration

- Reset restores approved initial/default values; does not depend on uncontrolled DOM resets for controlled Radix widgets.
- For edit forms populated after an async fetch, use `reset(serverDtoToFormDefaults)` once data identity changes; avoid infinite `useEffect` loops, stale dirtiness and lost edits.
- Decide how dirty unsaved user edits are protected from silent incoming query/cache updates; future page owns actual confirmation.
- No storing personally identifying form draft contents in localStorage/sessionStorage by default.
- Do not hide field errors when the user navigates tabs; address focus to first invalid field when possible.

---

# 9. Server errors and API contract integration

Step 16 planned/shared contracts and the existing Express error envelope must be read from the **actual repo**. Previously the API returned `{ success, data, meta.requestId }` on success; error envelope requires verification.

Implement a **pure, tested mapper** from the **actual** documented/typed error response to RHF errors. Do not invent hardcoded server response shapes or mix `AxiosError` imports into UI components if the app has a different fetch client. Model adapter may distinguish:

| Future result | Expected UI handling |
|---|---|
| `400` / `422` schema validation | Map supported `fieldErrors[path]` into `setError`; show unknown/global errors in summary |
| `401` unauthenticated | Generic session/auth notice; do not implement auth redirect now |
| `403` forbidden | Clear authorization denied text; don't suggest client retry circumvents it |
| `404` missing/not accessible | Not found message without leaking resource existence |
| `409` conflict/version race | Preserve user draft; show actionable conflict notice |
| `413` oversized body/file | Actionable size warning; no upload pipeline now |
| `429` rate-limited | Wait/retry later copy; no unsafe automatic replay |
| `5xx`, network/timeouts | Generic recoverable notice and optional request ID; don't expose stack/secret |

**Security:** the browser's validation is not authoritative; Express must revalidate and authorize in later feature steps. Never assume an API success solely from HTTP 200 without respecting actual envelope semantics. Do not leak server internal stack traces or raw JSON responses into end-user field messages.

Nested/array field-path mapping must be safe: reject suspicious `__proto__`, `constructor`, `prototype`, arbitrary property-pollution strings; restrict to actual RHF schema field paths where feasible, normalize dot/bracket paths deterministically, and avoid blindly executing content from response. Unknown names go to form-level summary instead of mutating unrelated fields. Tests should cover malformed/missing `errors` and requestId.

**No new backend features**: if current API only exposes health/readiness or lacks field-error details, demonstrate adapter behavior with typed, synthetic fixtures and record the future integration dependency. Do not add `/api/v1/projects` to make a UI test pass.

---

# 10. Form error summary and focus management

Provide a reusable form-level error presentation pattern (component if justified, else documented composition):

- Concise heading (e.g. **Please correct the highlighted fields**), count optional.
- Human-friendly field links/labels where possible; clicking focuses the correct input, Radix trigger or calendar button.
- When submit fails, focus first invalid field or error summary. Test race conditions around `handleSubmit` validation and portal focus.
- `aria-live="polite"` or targeted alert semantics for newly reported errors; avoid repetitive double announcements and automatic page-scroll jumps.
- Help/error ID stable across renders and associated with `aria-describedby` (without replacing existing helper text).
- Error visuals maroon-based semantic colors, but labels/icons/text remain meaningfully accessible.
- No sensitive raw Zod exception details in UI.

---

# 11. Accessibility & design QA

Components must inherit Step 17–19 tokens and primitives:

**Visual and interaction requirements:**

- Labels always visible where necessary. Placeholder does not replace a label.
- Required fields have clear text marker/accessible-required status; optional fields marked when helpful.
- Focus ring noticeable on white panels, soft warning cards, dialogs and overlays; do not use CSS `outline: none` without replacement.
- Contrast matches actual semantic pairs: normal text at least **4.5:1**, large text at least **3:1**, meaningful non-text indicators at least **3:1** where applicable.
- Invalid message is text, not hue only; use same maroon semantic family, never yellow text on white.
- Keyboard only: tab order logical; Select/Calendar/Dialog controls work with Space/Enter/Escape/arrows according to their primitive semantics.
- Screen reader relationships: label/ref/describedby/error ID, invalid/required semantics, correct fieldsets for grouped choices.
- Reduced-motion respected; no animated validation that hides critical messages.
- Responsive test widths near **320, 375, 768 and 1280 CSS px**: no horizontal overflow, floating error panels offscreen, clipped labels, impossible DatePicker controls or unreachable Submit.
- Do not claim complete WCAG/AT certification because isolated tests passed; record which browser/assistive tech were actually checked.

---

# 12. Domain-safe example fixtures (dev/tests only)

Use **small, explicitly synthetic** sample data to verify the reusable infrastructure, not actual future feature workflows. Example UI test fixture:

```text
Demo Form (internal development/test only)
- Summary title: required, 3..120 characters, trim input
- Agency reference: selected from two synthetic options
- Work category: enum-shaped local sample, no actual permission claim
- Start date: YYYY-MM-DD date-only
- End date: YYYY-MM-DD; cross-field end >= start (illustrative)
- Estimated amount: optional, displayed in LKR and parsed with exact integer minor units
- Notes: optional textarea, max 500 characters
- Submit: asynchronous test callback with optional synthetic server error
```

**Critical:** Do not introduce fake real project codes/statuses or real ministry data. If using `GOV_ADMIN`, align with actual approved role key; don't use legacy `GOVERNMENT_ADMIN`. Do not create actual ProjectTrace projects, RoadSync work requests, payments, approvals, or notifications.

Dev-only harness, if added, must **not be publicly routable in production**. Better to use test fixtures/Storybook if already installed. Avoid installing a new showcase framework just for this step.

---

# 13. Implementation sequence and scoped tasks

## Batch A — verify/reuse Step 19 form primitives

1. Audit `Form`/`Input`/`Textarea`/`Select`/`DatePicker`/`Checkbox`/`Label`/`Button`/`Alert`/`Toast` for ARIA, ref forwarding, client boundaries and semantic token usage.
2. Decide which wrappers are truly missing; list unchanged reused components and minimal edits.
3. Confirm package versions and resolver Zod compatibility with compile-focused sandbox/test.
4. Implement FormProvider/FormItem/FormControl/FormLabel/FormDescription/FormMessage wiring, or keep verified existing shadcn implementation.
5. Run basic field association + type-check tests.

## Batch B — strongly typed field adapters

1. Add thin typed adapters for Text/Input, Textarea, Select and DatePicker, or document standard `Controller` composition if wrappers would overabstract.
2. Support controlled values, clear/empty, disabled/readonly, `aria-invalid`/`aria-describedby`, error text, help text, `ref`/focus.
3. Optional Checkbox/Radio fields based on installed primitives, using Boolean/array semantics.
4. Review App Router server/client boundaries and bundle impact.
5. Test controllers with actual RHF `formState`, default values and changes.

## Batch C — schema validation & normalization

1. Establish local form-schema conventions aligned with Step 16 contracts and current Zod version.
2. Add a few pure normalization helpers **only where evidence warrants reuse**: safe trim, optional blank, decimal-to-minor-unit money, date-only validation (calendar dates), opaque ID value and array defaults.
3. Write tests for empty vs null vs missing, whitespace only, Unicode, invalid numeric inputs, leading zero, negative values, decimal precision and date chronology.
4. Avoid a generic giant `schemaFactory` or magic schema-driven auto-form engine.

## Batch D — submit lifecycle, API errors and focus

1. Define optional form-actions pattern for Submit/Cancel/Reset using existing Button, disable while submitting.
2. Add tested server-error adapter aligned to actual error envelope; unknown paths go to summary, do not override unrelated form state.
3. Handle general errors, requestId correlation and retry copy.
4. Add first-invalid-field focus/summary UX and prevent double success/error toasts.
5. Test reset after a success callback vs preservation after error and double-submission handling.

## Batch E — integrated QA fixture and docs

1. Demonstrate all components together in tests or production-gated dev-only preview; synthetic data only.
2. Confirm TypeScript input/output schema generics with `z.input`/`z.output` and transformed money/date values.
3. Check keyboard, screen reader semantics, narrow viewports and responsive field spacing.
4. Execute lint, typecheck, targeted tests, app build and broad regression checks.
5. Document patterns, variants, safe integration with future ProjectTrace/RoadSync routes, known limitations, migration notes and step boundaries.

**Do not progress to Step 21**, even if the UI demo includes a basic list of submitted fixture values.

---

# 14. Testing plan — explicit cases

Adapt to actual project's Vitest/Jest + Testing Library/user-event/Playwright/axe availability; avoid introducing redundant test frameworks.

## Unit tests (schemas/helpers)

- Valid/invalid required string, trimming, min/max; `" "` cannot silently pass as a meaningful title.
- Optional blank/null/undefined normalization without corrupting expected DTO shape.
- `z.input` vs `z.output` type checking for transforms.
- Date-only leap day valid vs non-leap invalid; timezone/off-by-one controls; `end < start` invalid; empty date explicit.
- LKR decimal display to **integer minor units** without floating-point rounding or coercing blank to zero; excessive precision, negative, infinity, NaN and scientific notation rejected if not allowed.
- Cross-field errors attached to the intended field/path.
- Field array stable IDs and nested indexes, if included.
- Error mapper handles one/multiple fields, nested paths, unknown paths, malformed errors, 409, 429, network failures, missing request ID, prototype pollution attempts.

## UI interaction tests

- RHF field label associates with input/Select trigger/DatePicker.
- Required/disabled/read-only/error states and `aria-invalid`/`aria-describedby` are correct.
- Select keyboard value selection, blur and reset.
- Calendar date selection, clearing and reset; no timezone drift.
- Button prevents repeat submit while async callback pending; `aria-busy`/loading label makes sense.
- On client validation failure, focus correct field/error summary; no `onSubmit` call.
- On server field validation failure, preserve values and attach correct errors.
- On success, only show success after resolved callback; reset policy documented.
- On 401/403/409/429/5xx, display appropriate non-sensitive general error; never pretend saved.
- Cancel/reset distinguishes dirty and clean state (no automatic destructive dirty-close).
- Long agency/project name, Unicode text, and optional/conditional field cases.
- Toast/Alert output no double announcement or misleading success.

## Browser/manual checks (when supported)

- Narrow mobile 320px / common 375px, tablet 768px, desktop 1280px.
- Keyboard-only navigation, visible focus, Select/Popover focus restoration, submit error focus.
- Browser console/hydration messages; failed import/provider warnings.
- Manual dark-mode preservation only if current dark mode implemented; not a new theme.
- In-app form demonstration behind development-only control or use test harness.

## Workspace checks

Use **actual scripts/package manager discovered**. Typical examples, not literal demands:

```bash
npm run lint --workspace apps/web
npm run type-check --workspace apps/web
npm run test --workspace apps/web
npm run build --workspace apps/web
# plus repo root checks if available
npm run lint
npm run type-check
npm run test
npm run build
```

If typecheck is named `typecheck` instead of `type-check`, discover and use it. Do not mark unavailable scripts as success. Run the smallest affected tests first, then broad checks; distinguish pre-existing failures from regressions with logs/evidence.

---

# 15. Security, privacy, RBAC and authorization review

A frontend validation system supports users but **does not authorize requests**. Verify:

- No private API secrets, JWTs, production credentials or real personal data in client code/sample forms.
- No DOM `dangerouslySetInnerHTML` for user input or server errors; React escaping remains intact.
- Error text is safe, limited and human-readable; don't expose server stack traces or raw developer internals.
- No password, refresh-token or payment-card values logged/telemetry captured by the form system.
- No browser-storage persistence of drafts containing personal data unless later explicit consent/requirements justify it.
- No unsafe redirects or untrusted links in error summaries.
- No client `role === ADMIN` used as definitive permission; user/agency/resource/workflow checks belong to Express.
- No changing shared DB schemas, role catalog or money/GeoJSON model constraints to make forms easier.
- No unbounded payload submission/demo fixture arrays; form schemas demonstrate length bounds, but server quotas remain required.
- Avoid leaking resource presence from future 403/404 outcomes; keep wording neutral where applicable.
- Consider abort/unmount races and stale async responses; don't update React state after cancellation or overwrite newer input with old server errors.

**Backend integration requirement:** Read and document actual API error/response contract and how future services will connect. Do not add unauthorized backend modules/routes simply because some form tests need a mocked response. Any missing server error details should be noted as a future integration gap, not silently fabricated in production type definitions.

---

# 16. Code review and integration review criteria

Every changed file must be reviewed for:

- Single source of design tokens, no stray old palette values.
- Correct React 19 / Next App Router boundary and hydration behavior.
- RHF + Zod resolver type correctness (especially input/output transformations).
- Accessibility of labels, descriptions, invalid states, focus, fieldset/legend, keyboard and alert regions.
- Controlled Select/Calendar default/reset/disabled/blur behavior.
- Stable error keys/field-path mapping, no prototype pollution/string injection.
- Async submission double-click/retry/cancellation and distinction between success/error.
- Money/date precision and API DTO boundaries.
- Unchanged existing Step 19 component behavior and Step 16 contract compatibility.
- No unnecessary dependency upgrades or unused wrappers/frameworks.
- No changes to unrelated API/database/AI/map/auth files.
- No logging/shipping sample sensitive data; no unapproved route in production.
- Adequate tests, documentation and developer ergonomics.

**Post-review discipline:** Record found issues, fix within scope, re-run unit/interaction/build/regression checks, and update the report. An unresolved form validation type error, unsafe server-error mapper, or broken basic UI keyboard navigation is a `BLOCKED`/`PARTIAL`, not a complete Step 20.

---

# 17. Documentation deliverables

Create or update existing docs (do not duplicate files needlessly):

```text
docs/design/forms-and-validation.md
  - Architecture, imports, RHF provider patterns, Controller examples, shadcn mappings
  - Required/optional/disabled/readonly/error controls
  - Standard submit/reset/error/focus UX, accessible copy
  - Date-only and integer LKR minor-unit rules
  - Sample component usage and anti-patterns

docs/architecture/form-data-contracts.md
  - input -> Zod output -> future DTO mapping
  - Step 16 status/field alignment, server trust boundary, API envelope evidence
  - server field-error mapping and requestId usage
  - deferred API/auth/GIS/finance integrations

docs/testing/step-20-form-test-matrix.md
  - Unit/interaction/keyboard/viewport/build test cases and actual results
  - Baseline vs new regressions; NOT RUN and reason

docs/reviews/step-20-post-implementation.md
  - Findings, patches, re-test evidence, files, Git state, acceptance results
```

If standard project docs already contain these sections, update those existing files instead of creating redundancy. Provide concise code examples for `useForm` + `zodResolver`, a controlled Select, DatePicker, `handleSubmit`, reset, error mapper and form-level summary. Examples must compile against **actual installed versions**, not conceptual pseudocode presented as production code.

---

# 18. Mandatory post-implementation review template

Complete using actual evidence:

```text
STEP 20 POST-IMPLEMENTATION REVIEW

A. GIT / SCOPE
Base development commit and Step 19 merge evidence:
Feature branch and starting HEAD:
Initial worktree and preserved untracked files:
Changed files and dependency/lockfile diffs:
Any unrelated edits or scope exceptions:

B. ARCHITECTURE / TYPE SAFETY
RHF/Zod/resolvers versions:
FormProvider/FormField/Controller architecture:
Input/output generic correctness:
Step 19 primitive reuse:
Client/server component boundaries:
No backend/private imports:

C. IMPLEMENTATION CHECKLIST
Labels, help, invalid and required semantics:
Controlled input/textarea/select/date/checkbox:
Defaults/reset/edit populate:
Submitting/double-submit prevention:
Client validation and cross-field errors:
Server field/general error mapper:
First-invalid-focus/error summary:
Date-only normalization and money minor units:
Dev-only synthetic fixture and production gating:

D. SECURITY / PRIVACY
Browser validation vs backend authorization:
No secret/PII logging/injection:
Proto-pollution/unknown field mapping tests:
No unsafe storage or fake server success:
No unapproved API/DB/auth changes:

E. ACCESSIBILITY / VISUAL
Approved semantic brand colors reused:
ARIA associations, focus, keyboard, announcements:
Mobile/tablet/desktop layout:
Dark mode preservation/reduced motion:
Manual and automated evidence:

F. TESTING (with command, result, evidence)
Baseline lint/types/tests/build:
Focused schema tests:
RHF interaction tests:
Error-mapper/adversarial tests:
Web lint:
Web typecheck:
Web test:
Web build:
Workspace regression:
Browser check:

G. DEFECTS / FIXES
Failures reproduced:
Scoped fixes and why:
Commands re-run after fix:
Remaining blockers:

H. DOCS / GIT HANDOFF
Docs added/updated:
Git diff --check and untracked audit:
Suggested commit:
PR target and intended reviewers:
Post-merge regression plan:
Approval pending:
```

---

# 19. Step 20 acceptance checklist / Definition of Done

**Mark COMPLETE only if** the actual repository shows:

- [ ] Step 19 implemented/reviewed/merged to `development`; Steps 16–18 dependencies read and compatible.
- [ ] Written pre-review with actual Git/package/component/test baseline and safe feature branch.
- [ ] RHF + Zod + compatible resolver typed correctly, preserving `z.input`/`z.output` where transformations occur.
- [ ] Reusable shadcn Form layer and practical field composition, not a second form framework.
- [ ] Input, Textarea, Select, DatePicker, relevant checkbox/group patterns wired with errors, labels, ARIA, refs, reset and disabled states.
- [ ] Clear required/optional/empty/null/undefined handling without malformed DTOs.
- [ ] Sync/cross-field validation examples tested; **no invented backend business validations**.
- [ ] Exact LKR integer-minor-unit transformations and date-only/timezone semantics documented/tested where included.
- [ ] Async form submission state prevents repeated submits, preserves inputs on errors, reports real callback success only.
- [ ] Actual server-error envelope inspected and pure mapper safely tested; missing backend API features deferred.
- [ ] Field/general errors accessible, form summary/focus strategy works; unknown/malicious error keys handled safely.
- [ ] Keyboard navigation/labels/focus/contrast responsive checks performed where tools available or accurately reported `NOT RUN`.
- [ ] Relevant unit and interaction tests pass; actual lint/type-check/build verified; failing blockers reported.
- [ ] No regression in existing Steps 17–19 UI or Step 16 shared contracts.
- [ ] No unauthorized ProjectTrace/RoadSync/auth/backend/DB/AI/GIS feature changes or Step 21+ work.
- [ ] Security/privacy review passes and examples contain only synthetic data.
- [ ] Docs, post-review findings/fixes/retests and scoped Git diff ready for PR review.
- [ ] Commit/push/merge remains explicitly approval-gated; `main` unchanged.
- [ ] Final agent report describes real evidence and **stops after Step 20**.

---

# 20. Final report and STOP rule

```text
INFRAOS — STEP 20: FORMS & VALIDATION UI SYSTEM

STATUS: COMPLETE / PARTIAL / BLOCKED
Why (if not complete):
Dependency and Step 19 merge proof:
Base development commit:
Feature branch:
Initial dirty/untracked work handling:
Actual code changes:
Component wrappers reused/new:
RHF/Zod/resolver integration:
Schemas/normalizers/field-mapper behavior:
Accessibility, contrast, keyboard and focus:
Submission/reset/validation/error states:
Security and client/server boundaries:
Files created/updated and docs:
Test results (each PASS/FAIL/NOT RUN):
Bug fixes and repeated test evidence:
Outstanding issues / intentionally deferred items:
Git status / diff --check / staged and untracked audit:
Suggested commit: feat(ui): add typed accessible form and validation foundation
Proposed PR: feature/step-20-forms-validation-ui -> development
Approval status: NOT REQUESTED / PENDING / APPROVED (only if verified)
Post-merge check instructions:
main updated? NO unless separate authorized release:
Next planned Step 21: Advanced Data Table System (NOT STARTED)
```

**STOP.** Never automatically begin Step 21, merge into `development`, change `main`, modify another teammate's work, or misrepresent tests as run. Wait for explicit next instruction and Git authorization.
