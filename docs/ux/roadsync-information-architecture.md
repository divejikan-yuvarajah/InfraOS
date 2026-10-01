# INFRAOS RoadSync Information Architecture

**Document:** `/docs/ux/roadsync-information-architecture.md`  
**Step:** 05  
**Status:** Locked  
**Owner:** Team leader  
**P0 without AI**

Do not bury coordination inside generic project pages only. RoadSync is a **first-class workspace**.

---

## 1. Hub `/roadsync`

Show:

- open work requests
- active conflicts
- high-severity count
- pending coordination **for this agency**
- recently resolved
- map preview (link to `/map?layers=conflicts`)

CTA: **New work request** → `/roadsync/work-requests/new`

---

## 2. Information structure

```text
Work requests → Conflicts → Coordination → Resolution → History
```

| Route | Job |
|-------|-----|
| `/roadsync/work-requests` | List / filter |
| `/roadsync/work-requests/new` | Geometry + dates |
| `/roadsync/work-requests/[id]` | One WR + detections |
| `/roadsync/conflicts` | Queue by severity |
| `/roadsync/conflicts/[id]` | Map + parties + resolve |
| `/roadsync/coordination` | Inbox of PENDING responses |

History lives on conflict detail (no extra `/history` URL).

---

## 3. Conflict detail layout

Desktop: map (left/top) + facts + coordination thread + resolve panel.  
Mobile: map + bottom sheet for thread/actions.

Simulator copy (P1) is a **panel**, not a separate route.

---

## 4. Empty copy

“No active conflicts. Create a work request to detect nearby work.”
