# INFRAOS Map Information Architecture

**Document:** `/docs/ux/map-information-architecture.md`  
**Step:** 05  
**Status:** Locked  
**API:** viewport `GET /api/v1/map`  
**Staff route:** `/map` · **Public:** `/public-map`

---

## 1. Regions

```text
Main canvas
Layer controls
Search (places / project code)
Filters (status, agency, dates)
Legend
Selected-item detail
Quick nav (open full project / conflict)
```

### Desktop

```text
[ Layers | Search | Filters ]
[           Map canvas              | Detail drawer ]
[ Legend ]
```

### Mobile

```text
Full map
Compact chip row (layers / filters → sheet)
Bottom sheet for selection (not hover-only)
```

---

## 2. Query state

```text
/map?layers=projects,work,conflicts&status=ACTIVE&agency=
/public-map?layers=projects
```

No secrets in query. Bbox is **request body/query from the client viewport**, not a shareable secret.

---

## 3. Legend / status color

Use Step 5 semantic colors **plus labels**: High conflict = maroon + “High”; completed = green + “Completed”.

---

## 4. Failure

Tiles down: banner + retry; user can still open `/projects`. Empty viewport: “No features in this view. Zoom out or change filters.”
