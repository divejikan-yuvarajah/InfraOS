# Forms and validation (Step 20)

## Stack

React Hook Form + Zod (`zodResolver`) + Step 19 primitives.

Policy: `mode: "onBlur"`, `reValidateMode: "onBlur"`, `shouldFocusError: true`.

## Layers

| Piece | Path |
|---|---|
| Form primitives | `apps/web/src/components/ui/form.tsx` |
| Field adapters | `apps/web/src/components/forms/fields.tsx` |
| Submit/reset | `apps/web/src/components/forms/form-actions.tsx` |
| Summary | `apps/web/src/components/forms/form-error-summary.tsx` |
| Normalizers | `apps/web/src/lib/forms/normalizers.ts` |
| API error map | `apps/web/src/lib/forms/errors.ts` |
| Synthetic schema | `apps/web/src/lib/forms/demo-coordination-schema.ts` |

## Trust boundary

Zod output is **format-checked in the browser only**. Express must revalidate and authorize. Do not treat a successful client submit as a saved project.

## Dates and money

- Dates stay `YYYY-MM-DD` (Step 19 date-only helpers).
- Optional LKR text becomes integer **minor units**, or `undefined` when blank. Blank is never `0`.

## Server errors

`mapApiFailureToFormErrors` reads `error.details.fieldErrors` only for `VALIDATION_ERROR` and only for an allow-list of paths. Unsafe keys (`__proto__`, `constructor`, `prototype`) and unknown paths stay on the form summary. Status copy for 401/403/404/409/429/5xx does not show stack traces.

## Out of scope

Project create, work requests, auth screens, uploads, and Step 21 tables.
