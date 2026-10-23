# Step 41 handoff

Step 40, once merged, logs out the current refresh family only.

Step 41 is password reset request. It is not started.

Still open after this local Step 40 build:

- Atlas indexes for `refresh_families` are not created.
- Browser logout was not run.
- No logout control in the product UI. The public landing stays unchanged on purpose.
- An access JWT issued before logout still works until it expires.
- Sessions created before the family guard exists cannot be closed with a `204`. Logout returns `503` for those cookies.
- The 10 second refresh grace still avoids theft-revoke when the family is open. It does not reopen a closed family.
