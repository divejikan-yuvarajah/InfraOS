# Step 42 handoff

Step 41 requests a reset. It does not change the password and does not close refresh families.

Step 42, when approved, should:

- Consume one `RESET_PASSWORD` challenge by digest.
- Reject expired, revoked, consumed, and wrong-purpose tokens.
- Replace `passwordHash` with bcryptjs cost 12 using the existing 8-character and 72-byte rules, without trimming.
- Close every open refresh family for that user.
- Keep the same account eligibility. Do not activate or verify the user.
- Add `/reset-password` UI that reads `#token=` into memory and strips the fragment. Do not put the token in a query string.

Do not start Step 42 until the owner approves Step 41.
