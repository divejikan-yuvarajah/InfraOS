# Navigation integration

## Current routes

| Path | In shell nav | Notes |
|------|----------------|-------|
| `/` | Yes (`Foundation`) | Public foundation page |
| `/_not-found` | No | Framework |

## Future modules

ProjectTrace, RoadSync, InfraMap, and later modules stay out of `APP_NAVIGATION` until their routes exist. A development preview may list them as **Coming later** without `href`.

## Authorization seam

Pass an optional `contextLabel` only when a later server session supplies a non-sensitive label. Do not decode JWTs or filter nav by client-side roles. Express remains the authorization boundary (Steps 35–50).
