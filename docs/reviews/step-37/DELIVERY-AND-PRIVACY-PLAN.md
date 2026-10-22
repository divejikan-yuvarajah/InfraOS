# Delivery and privacy plan

## Sender

| Environment | Behavior |
|---|---|
| `test` and `development` | In-memory `VerificationEmailSender`. Captured messages stay in process memory for tests. |
| `production` | Sender mode `unavailable`. No challenge is written. The HTTP body is still the generic acceptance. Delivery status: **BLOCKED** (no approved provider). |

The public JSON is `{ status: "ACCEPTED" }` or a generic validation failure. It does not say that an email was sent, and it does not echo the address.

## Link base

`verificationLink` accepts only the configured `FRONTEND_ORIGIN`. HTTPS is required except for `localhost` and `127.0.0.1`. `Host`, `X-Forwarded-Host`, `returnTo`, and `next` are not inputs to the URL. A body that includes `returnTo` or `next` is rejected.

Responses set `Referrer-Policy: no-referrer`. The request logger records method and path, not the body. Tokens are placed in the URL fragment so a later page request would not send them to the server. No verification page is shipped on this branch.

## Abuse

- Account cooldown: 60 seconds.
- One outstanding challenge per user and purpose.
- Existing application rate limit still wraps these routes.
- Unknown addresses do not create mail.

Timing of the missing-account path and the existing-account path is not equalized. The external status and body are the same. That residual is accepted for this step because a fixed delay would be a denial-of-service amplifier.

## Audit

In-memory events store a category, `requestId`, and user id. They do not store the raw token, link, or email address. They are not a durable audit log.

## Template

No production template is sent. A future provider must identify INFRAOS as a university demonstration, include the expiry, and avoid any claim of government affiliation. Sinhala and Tamil copy is not added because there is no page. Native review: **PENDING**.
