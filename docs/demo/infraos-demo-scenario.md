# INFRAOS synthetic demo scenario

> **Synthetic prototype data only — not official Government of Sri Lanka records.**

## Story arc

```text
Road project (INF-ROAD-001)
  → water work request overlap candidate (INF-WATER-001)
  → future RoadSync coordination (not implemented in Step 15)
  → progress + finance + inspection variance
  → completed bridge (INF-BRIDGE-001)
  → asset + maintenance
  → citizen issues routed to demo agencies
```

## Primary RoadSync candidate pair

| Work | Project | Agency | Schedule (UTC) | Geometry |
|------|---------|--------|----------------|----------|
| Road resurfacing | `INF-ROAD-001` | `DEMO_RDA` | 2026-01-10 → 2026-04-20 | Colombo corridor LineString |
| Water main | `INF-WATER-001` | `DEMO_WATER` | 2026-03-01 → 2026-05-01 | Overlapping corridor LineString |

Future intent: complete underground water work before final road resurfacing. **No conflict documents are seeded.**

## Controls

| Control | Purpose |
|---------|---------|
| Drainage work in Kandy area | Far location — must not appear in Colombo spatial probe |
| Road excavation 2027 | Same corridor — schedule non-overlap |
| Utility repair parallel line | Nearby but non-intersecting — future `NEARBY_WORK` differentiation |

## Project states (sample)

| Code | Status | Notes |
|------|--------|-------|
| `INF-ROAD-001` | ACTIVE | Main corridor, milestones, inspections |
| `INF-WATER-001` | APPROVED | Conflict candidate project |
| `INF-TELECOM-001` | DRAFT | Telecom agency |
| `INF-DRAINAGE-001` | ACTIVE | Hosts far control work |
| `INF-PFAC-001` | DELAYED | Risk fixture `DEMO-RULES-v1` |
| `INF-BRIDGE-001` | COMPLETED | Asset handover |
| `INF-DRAFT-001` | DRAFT | Planning office |

## Milestones (road project)

1. Drainage Preparation — completed  
2. Road Base Preparation — in progress  
3. Asphalt Work — not started  
4. Road Marking — not started  

## Finance & inspection

- Payments on `INF-ROAD-001` use LKR minor units; submitter ≠ approver.  
- Verified inspection records **68%** physical progress vs project **75%** reported — documented variance, not fraud.

## Asset chain

`INF-BRIDGE-001` → **Demo Riverside Bridge Asset** → one completed + one scheduled maintenance.

## Citizen issues

Synthetic pothole, water leak, drainage, and streetlight reports near Colombo with agency routing.

## Deferred

- Interactive login / passwords  
- Notifications  
- Document storage URLs and RAG embeddings  
- RoadSync conflict engine and AI risk scoring  

## Commands

```bash
npm run db:seed:demo
npm run db:seed:verify
npm run db:seed:demo   # idempotency check
```

Optional:

```bash
npm run db:seed:reset-demo
npm run db:seed:demo
npm run db:seed:verify
```
