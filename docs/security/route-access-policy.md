# INFRAOS Route Access Policy

**Document:** `/docs/security/route-access-policy.md`  
**Step:** 05  
**Status:** Locked  
**UX nav:** [../ux/navigation-by-role.md](../ux/navigation-by-role.md)  
**API remains authoritative** ([permission-matrix.md](./permission-matrix.md))

`Allowed roles` help Next.js middleware **UX redirects only**. Data access still uses permission + scope.

Fallback: unauthenticated → `/login?next=` (open redirect safe: same-origin paths only). Authenticated without capability → **403**. Authenticated without resource → **404**.

---

## Public

| Route pattern | Auth | Permission | Scope | Roles | Fallback |
|---------------|------|------------|-------|-------|----------|
| `/` `/about` `/features` `/how-it-works` `/faq` `/contact` | Public | None | PUBLIC | All | — |
| `/public-projects` `/public-projects/[id]` | Public | Public DTO | PUBLIC | All | 404 if not public |
| `/public-map` | Public | `map.view.public` | PUBLIC | All | Empty map |
| `/report-issue` | Public | `citizen_issue.create` | PUBLIC | Anon + CI | Rate limit 429 |

---

## Auth

| Route pattern | Auth | Notes | Authed behavior |
|---------------|------|-------|-----------------|
| `/login` | Public | No role picker | Redirect `/dashboard` |
| `/verify-email` `/forgot-password` `/reset-password` | Public | P1 | If session, still allow reset flow |

---

## App

| Route pattern | Auth | Required permission | Scope | Typical roles | Fallback |
|---------------|------|---------------------|-------|---------------|----------|
| `/dashboard` | Yes | Any staff session | Role widgets | All staff | Login |
| `/projects` | Yes | `project.read` | List filter | SA GA AO PM CO IN | 403 CO/IN OK if assigned exist |
| `/projects/new` | Yes | `project.create` | Agency/org | GA AO PM | 403 |
| `/projects/[id]/*` | Yes | Tab permission | Resource | Per matrix | 404 |
| `/roadsync` `/roadsync/**` | Yes | `roadsync.work_request.read` or `roadsync.conflict.read` | Scoped | SA GA AO PM | **403** CO IN CI |
| `/map` | Yes | `map.view.internal` | Layers | Staff except none | 403 citizen → use public-map |
| `/contractors` `/contractors/[id]` | Yes | `contractor.read` | Scoped | SA GA AO PM | 403 CO (except own later P1) IN CI |
| `/assets` `/assets/[id]` | Yes | `asset.read` | Scoped | SA GA AO PM IN limited | 403 CO |
| `/documents` | Yes | `document.read` | Scoped | Staff with perm | 403 |
| `/inspections` `/inspections/[id]` | Yes | `inspection.read` | Assigned/scope | IN PM GA AO SA | 403 CO |
| `/issues` `/issues/[id]` | Yes | `citizen_issue.read` | Agency/org/own | SA GA AO | 403 PM CO IN typical |
| `/notifications` | Yes | `notification.read` | Own | All staff | Login |
| `/reports` | Yes | `report.view` | Scoped | SA GA AO PM | 403 CO IN |
| `/profile` | Yes | `profile.read` | Own | All staff | Login |
| `/settings` | Yes | profile/prefs | Own | All staff | Login |

---

## Admin

| Route pattern | Auth | Permission | Scope | Roles | Fallback |
|---------------|------|------------|-------|-------|----------|
| `/admin` `/admin/users` | Yes | `user.read` | Platform/org | SA, GA org | 403 |
| `/admin/agencies` | Yes | `agency.read` | Platform/org | SA, GA | 403 |
| `/admin/roles` | Yes | `role.read` | Platform | SA (GA read-only if granted) | 403 |
| `/admin/audit-logs` | Yes | `audit.read` | Platform/org | SA, GA | 403 |
| `/admin/system` | Yes | `system.manage` | Platform | **SA only** | 403 |

---

## Errors

`/403` `/404` `/500` `/maintenance` — public, no auth, `noindex`.
