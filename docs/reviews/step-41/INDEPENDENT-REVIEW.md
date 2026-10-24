# Step 41 review note

**Second pass against the Step 41 specification and the diff from `4e97f42`.** The same workspace produced the original implementation and this review. Treat it as a hostile re-read, not a separate person.

## Finding fixed in this pass

Failed delivery revoked the previous live challenge and did not restore it (`password-reset-request.service.ts` send `catch`). A later provider error would destroy a token that had already been handed to the memory sender. The catch now revokes only the undelivered row, then clears `revokedAt` on the previous row. Regression: `restores the previously delivered challenge when a later send fails`.

The link assertion now expects the literal `http://localhost:3000/reset-password#token=` form. The concurrent test waits until both callers are inside `beforeInsert` before release.

## Residuals

- Unknown and ineligible requests return before the insert path, so wall-clock time can still differ. Status and body stay `200` / `ACCEPTED`. No artificial delay was added.
- Live inbox delivery is **BLOCKED**. Production sender mode is `unavailable` and writes nothing.
- Atlas indexes were not created. Development `autoIndex` can still create them if `dev:api` starts against Atlas.
- Browser walkthrough was **NOT RUN**.

## What was checked

- Request route uses origin rejection, JSON content type, strict Zod, no-store, and `Referrer-Policy`.
- Success body is only `{ status: "ACCEPTED" }`.
- Eligibility matches sign-in and does not mutate the user.
- Open challenges are revoked before a new insert so an expired row cannot block the partial unique index.
- Production sender mode does not send and does not write a challenge.
- Failed send revokes the new challenge and still returns the generic accepted result from the service. The HTTP layer still returns 200.
- Tokens stay in the injected memory sender for tests. They are not written to the API JSON body.

## Residual

- Response timing can still differ between unknown and eligible emails. Not measured.
- Starting `dev:api` in development can create `password_reset_challenges` indexes through Mongoose `autoIndex`.
- Sinhala and Tamil copy is marked draft.

**Disposition:** ready for owner review. Not an independent PASS.
