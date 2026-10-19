# Response and error format

Live helper: `apps/api/src/shared/http/envelope.ts`. Shared types: `ApiSuccess`, `ApiFailure`, `ApiResponse`.

```json
{ "success": true, "data": {}, "meta": { "requestId": "…" } }
```

```json
{
  "success": false,
  "error": { "code": "RESOURCE_NOT_FOUND", "message": "Project not found", "details": null },
  "meta": { "requestId": "…" }
}
```

`requestId` is required. List responses may add `page`, `limit`, `total`, and `totalPages` on `meta`.

Implemented codes today: `VALIDATION_ERROR`, `RATE_LIMITED`, `NOT_READY`, `INTERNAL_ERROR`.

Additional catalog codes are reserved for later auth and domain routes: `AUTH_REQUIRED`, `SESSION_EXPIRED`, `FORBIDDEN`, `INSUFFICIENT_PERMISSION`, `RESOURCE_SCOPE_DENIED`, `RESOURCE_NOT_ASSIGNED`, `RESOURCE_NOT_FOUND`, `INVALID_STATE_TRANSITION`, `DUPLICATE_RESOURCE`, `CONFLICT_DETECTED`, `SERVICE_UNAVAILABLE`.

Errors must not include stack traces, connection strings, tokens, or signed URLs.

| Code | HTTP |
|---|---|
| VALIDATION_ERROR | 400 |
| AUTH_REQUIRED, SESSION_EXPIRED | 401 |
| FORBIDDEN, INSUFFICIENT_PERMISSION, RESOURCE_SCOPE_DENIED, RESOURCE_NOT_ASSIGNED | 403 |
| RESOURCE_NOT_FOUND | 404 |
| INVALID_STATE_TRANSITION, DUPLICATE_RESOURCE, CONFLICT_DETECTED | 409 |
| RATE_LIMITED | 429 |
| INTERNAL_ERROR | 500 |
| NOT_READY, SERVICE_UNAVAILABLE | 503 |
