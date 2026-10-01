# INFRAOS Route Map

**Document:** `/docs/ux/route-map.md`  
**Step:** 05  
**Status:** Locked  
**Inventory:** [page-inventory.md](./page-inventory.md)

---

## 1. Naming rules

- lowercase, kebab-case, plural collections
- no verb URLs (`/manage-projects` ❌)
- avoid deep nests beyond `/resource/[id]/section`
- stable Mongo id in path; display code in UI

**Supersedes Step 3 sketch:** `/roadsync/new` → `/roadsync/work-requests/new`. Added `/roadsync/work-requests`, `/inspections`, `/issues/[id]`.

**Not V1:** `/register`, `/mfa`, `/auth/callback`, `/admin/feature-flags`.

---

## 2. Hierarchy

```mermaid
flowchart TD
  subgraph public["Public"]
    R0["/"]
    R0 --> About["/about"]
    R0 --> Feat["/features"]
    R0 --> How["/how-it-works"]
    R0 --> PP["/public-projects"]
    PP --> PPid["/public-projects/id"]
    R0 --> PM["/public-map"]
    R0 --> RI["/report-issue"]
    R0 --> Faq["/faq"]
    R0 --> Contact["/contact"]
  end

  subgraph auth["Auth"]
    Login["/login"]
    VE["/verify-email"]
    FP["/forgot-password"]
    RP["/reset-password"]
  end

  subgraph app["App"]
    Dash["/dashboard"]
    Pr["/projects"]
    Pr --> PrNew["/projects/new"]
    Pr --> PrId["/projects/id"]
    PrId --> Ov[".../overview"]
    PrId --> Tl[".../timeline"]
    PrId --> Ms[".../milestones"]
    PrId --> Doc[".../documents"]
    PrId --> Fin[".../finance"]
    PrId --> Ins[".../inspections"]
    PrId --> Rsk[".../risks"]
    RS["/roadsync"]
    RS --> WR[".../work-requests"]
    WR --> WRnew[".../work-requests/new"]
    WR --> WRid[".../work-requests/id"]
    RS --> Cf[".../conflicts"]
    Cf --> Cfid[".../conflicts/id"]
    RS --> Co[".../coordination"]
    Map["/map"]
    Cotr["/contractors"]
    Cotr --> Cotrid[".../id"]
    Ast["/assets"]
    Ast --> Astid[".../id"]
    Docs["/documents"]
    Insp["/inspections"]
    Insp --> Inspid[".../id"]
    Iss["/issues"]
    Iss --> Issid[".../id"]
    Ntf["/notifications"]
    Rpt["/reports"]
    Prof["/profile"]
    Set["/settings"]
  end

  subgraph admin["Admin"]
    A["/admin"]
    A --> U["/admin/users"]
    A --> Ag["/admin/agencies"]
    A --> Ro["/admin/roles"]
    A --> Au["/admin/audit-logs"]
    A --> Sy["/admin/system"]
  end

  subgraph err["Errors"]
    E403["/403"]
    E404["/404"]
    E500["/500"]
    Maint["/maintenance"]
  end
```

---

## 3. Redirects

| From | To |
|------|----|
| `/projects/[id]` | `/projects/[id]/overview` |
| `/admin` | `/admin/users` for SA (or first allowed child) |
| `/roadsync` | stays as hub (not a redirect) |

---

## 4. Query examples (shareable, non-secret)

```text
/projects?status=ACTIVE&page=1
/roadsync/conflicts?severity=HIGH
/map?layers=projects,conflicts&status=ACTIVE
/assets?condition=WARNING
/issues?status=ASSIGNED
```
