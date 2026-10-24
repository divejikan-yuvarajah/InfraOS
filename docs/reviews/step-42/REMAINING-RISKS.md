# Step 42 remaining risks

**When:** 2026-10-24 23:55 +05:30

| Risk | Status | Notes |
|---|---|---|
| Access JWT issued before reset stays valid until it expires | Accepted for this step | Reset does not add a denylist. Step 44 is the place that rechecks the account on protected routes |
| Refresh swap and the successor insert are two writes | Accepted for this step | Both are conditional on `credentialEpoch`. Tests cover reset-after-claim and reset-after-swap. They are not one transaction, so a crash between them can leave a family with a swapped hash and no successor. The old token no longer matches, and the epoch gate blocks a later refresh after reset |
| Role and agency reads inside `stillEligible` do not use the reset transaction session | Accepted | They read committed documents. A role deactivated in the same instant can theoretically pass. The next request still has to pass sign-in policy |
| In-memory reset token survives client-side navigations in the tab until success, rejection, or a full reload | Accepted | Required so Sinhala and Tamil switches do not drop the link. It is not written to `localStorage` or `sessionStorage`. A full reload without the fragment clears it. A 503 keeps it so the person can retry |
| Expired and reused tokens share one UI sentence | Accepted | The API does not reveal which failure happened |
| Sinhala and Tamil error and privacy sentences are still English | Accepted draft | Native review was already pending from Step 41 |
| Live email | **BLOCKED** | No approved sender. Production sender remains unavailable |
| Atlas indexes | **NOT RUN** | See `INDEX-MIGRATION-PROPOSAL.md` |
| Browser consume through the real API | **NOT RUN** | UI fixtures covered the page. Consume proof is the replica-set suite |
| Same-session review | Not a second person | Owner acceptance is still required |
| Timing of reset vs login bcrypt | Accepted | The login transaction re-reads the hash and epoch before insert. The test covers reset committing after the old password matched |
