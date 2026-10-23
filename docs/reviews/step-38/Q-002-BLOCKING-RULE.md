# Q-002 blocking rule for Step 39

**Recorded:** 2026-10-23  
**Status:** Product question remains open. This rule is the owner instruction for Step 39 implementation.

## Rule in force

1. Sign-in and refresh succeed only when the account status is `ACTIVE`, the role is active, and the agency is active.
2. Email verification never changes account status and never auto-activates `PENDING`.
3. `ACTIVE` accounts that are not email-verified stay blocked until a later owner decision closes Q-002.
4. No non-production seeded-staff login exception is approved.

Step 37 behavior is unchanged: consuming a verification token does not set `status` to `ACTIVE`.

## Source

Owner instruction on 2026-10-23, recorded in `docs/planning/assumptions-risks.md` (Q-002).
