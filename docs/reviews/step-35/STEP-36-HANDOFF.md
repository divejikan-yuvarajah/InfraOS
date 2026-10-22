# Step 36 handoff

Step 35 does not register users.

## Ready

- `User` email is unique and lowercased.
- `passwordHash` is required, `select: false`, stripped from `toJSON` and `toObject`.
- Default status is `PENDING`. `emailVerified` defaults to `false`.
- `Role` keys and permissions stay on the catalog. Registration must not accept a client-supplied permission list.
- `SafeUserDto` is the public shape. Do not return the Mongoose document.

## Still required in Step 36

- bcryptjs cost 12. The model only checks `minlength: 20`. It does not hash.
- Generic duplicate-email handling via the existing `DUPLICATE_RESOURCE` envelope. Do not echo whether the address exists if product policy says so; confirm that rule in the Step 36 prompt.
- No refresh cookie and no access JWT.
- No change to the public landing or the unmerged internal design-system branch unless that branch is merged first.

## Explicit non-goals for Step 36

Email verification (37), login UI (38), refresh issuance (39), logout (40), recovery (41–42), and route enforcement (43–46).
