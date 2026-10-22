# Step 37 handoff

Step 36 creates `PENDING` users with `emailVerified: false`. It does not issue a verification token or send mail.

Step 37 may add a purpose-specific hashed challenge. Do not store it in `refresh_sessions`. Do not activate `PENDING` staff only because a mailbox was proved, unless the owner defines that policy.

Q-002 is still open. Q-005 is still closed for public signup.

Do not start Step 37 on this branch. Use a new branch from `development` after Step 36 is merged and the owner asks for Step 37.
