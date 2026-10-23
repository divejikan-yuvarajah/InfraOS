# Steps 38–39 execution pointer

This path was required by the Step 39 gate. The repository did not contain a separate Codex execution prompt when Step 39 was gated on 2026-10-23.

## Where the instructions are

- Product scope: `Prompts/INFRAOS_Steps_38_39_Enhanced_Development_Prompt.md` when that file is present in the working tree. It was still an untracked local prompt at the Step 38 merge and is not part of this commit.
- Accepted session design: `docs/adr/ADR-006-jwt-access-refresh-session.md`
- Step 38 client handoff: `docs/reviews/step-38/STEP-39-HANDOFF.md`
- Q-002 rule for login: `docs/reviews/step-38/Q-002-BLOCKING-RULE.md`

## Step 39 execution already given by the owner

Implement only Step 39 on `feature/step-39-jwt-rotating-refresh`, branched from `origin/development` after the Step 38 merge. Gates are 39-0 (prerequisites), 39-A (security design), 39-B (login and rotating refresh API), 39-C (wire the Step 38 client), 39-D (adversarial tests), and 39-E (isolated demo and `docs/reviews/step-39/`). Do not start Step 40. Do not commit, push, or open a pull request for Step 39 unless the owner asks separately.
