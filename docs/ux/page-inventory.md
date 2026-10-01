# INFRAOS Page Inventory

**Document:** `/docs/ux/page-inventory.md`  
**Step:** 05  
**Status:** Locked — implement pages against this table later  
**Access:** [../security/route-access-policy.md](../security/route-access-policy.md)

Permission names are from [../security/permission-catalog.md](../security/permission-catalog.md). Scope is still applied on the API.

---

## Public website

| Page | Route | Module | Audience | Permission | Priority | Goal | Primary CTA | Main data | Mobile notes |
|------|-------|--------|----------|------------|----------|------|-------------|-----------|--------------|
| Home / landing | `/` | Marketing | Visitors, citizens | None | **P0** | Explain INFRAOS + trust | View public map / Report issue | Static + optional public stats | Stack hero; reduced GSAP |
| About | `/about` | Marketing | Visitors | None | P1 | Mission, SEUSL team | Contact / Login staff | Static | Readable sections |
| Features | `/features` | Marketing | Visitors | None | P1 | Modules without jargon | How it works | Static | Cards stack |
| How it works | `/how-it-works` | Marketing | Visitors | None | P1 | P0 spine story | Public projects | Static | Vertical timeline |
| Public projects | `/public-projects` | Citizen | Public | Public DTO | **P0** | Discover works | Open detail / Map | Public projects list | Cards not dense table |
| Public project detail | `/public-projects/[id]` | Citizen | Public | Public DTO | **P0** | Safe summary | Report nearby issue | Public project | Single column |
| Public map | `/public-map` | InfraMap | Public | `map.view.public` | **P0** | See nearby works | Select feature / Report | Public GeoJSON | Full map + bottom sheet |
| Report issue | `/report-issue` | Citizen | Public | `citizen_issue.create` (anon OK) | **P0** | Submit issue | Submit | Form + optional photo | Large tap targets; map picker sheet |
| FAQ | `/faq` | Marketing | Public | None | P1 | Answers | Report issue | Static | Accordion |
| Contact | `/contact` | Marketing | Public | None | P1 | Reach team | Submit (static/email P2) | Static | Simple form |

Auth: **not required**. SEO: yes. A11y: skip-link, headings, form labels on report-issue.

---

## Authentication

| Page | Route | Priority | Purpose | Authed user | Success | Errors | Security | Mobile |
|------|-------|----------|---------|-------------|---------|--------|----------|--------|
| Login | `/login` | **P0** | Staff login | Redirect `/dashboard` | Dashboard | Generic fail; lockout via rate limit | No role picker; HTTPS; no token in URL | Full-width form |
| Verify email | `/verify-email` | P1 | Confirm token | Dashboard if session | Verified | Expired token | Token in path/query **one-time**; not logged | Same |
| Forgot password | `/forgot-password` | P1 | Request reset | Stay | Generic success | Generic | No email enumeration | Same |
| Reset password | `/reset-password` | P1 | Set new password | Login | `/login` | Expired | POST token; revoke sessions | Same |

**Not shipped:** `/register` (admin-provisioned staff), `/mfa`, `/auth/callback` (P2).

---

## Operational application

| Page | Route | Module | Audience | Permission | Scope | Priority | Goal | Primary CTA | Data | Mobile |
|------|-------|--------|----------|------------|-------|----------|------|-------------|------|--------|
| Dashboard | `/dashboard` | Overview | Staff | `project.dashboard.read` or role home | Role | **P0** | Job-specific overview | Role-dependent | Aggregates | Cards; no 12-col charts |
| Projects list | `/projects` | ProjectTrace | Staff | `project.read` | Scoped list | **P0** | Find work | Create if allowed | Projects | Card list |
| New project | `/projects/new` | ProjectTrace | AO, PM, GA | `project.create` | Agency/org | **P0** | Create DRAFT | Save | Form + map | Map sheet |
| Project workspace | `/projects/[id]` | ProjectTrace | — | — | — | **P0** | Redirect | — | — | — |
| Overview | `/projects/[id]/overview` | ProjectTrace | Staff w/ read | `project.read` | Resource | **P0** | Summary | Edit/submit | Project | Sticky header |
| Timeline | `.../timeline` | ProjectTrace | same | `project.timeline.read` | Resource | **P0** | History | — | Activity | Vertical |
| Milestones | `.../milestones` | ProjectTrace | same | `milestone.read` | Resource | **P0** | Track | Add milestone | Milestones | Cards |
| Documents | `.../documents` | DocTrace | same | `document.read` | Resource | P1 | Files | Upload | Docs | List |
| Finance | `.../finance` | Finance | GA, AO, PM, SA read | `finance.budget.read` | Resource | P1 | Money | Add payment | Budget/pay | Cards |
| Inspections | `.../inspections` | Inspection | Staff | `inspection.read` | Resource | P1 | Verify | Request inspect | Inspections | Cards |
| Risks | `.../risks` | AI Risk | Staff | `risk.read` | Resource | P1 | Decision support | Run analysis | Scores | Fallback if AI down |
| RoadSync hub | `/roadsync` | RoadSync | AO, PM, GA, SA | `roadsync.work_request.read` | Scoped | **P0** | Coordination inbox | New work request | WR + conflicts | Cards + map peek |
| Work requests | `/roadsync/work-requests` | RoadSync | same | same | Scoped | **P0** | List WR | Create | WR | Cards |
| New work request | `/roadsync/work-requests/new` | RoadSync | AO, PM, GA | `roadsync.work_request.create` | Project | **P0** | Map + dates | Submit | Form GeoJSON | Map sheet |
| Work request detail | `/roadsync/work-requests/[id]` | RoadSync | same | `roadsync.work_request.read` | Resource | **P0** | Status | Recalculate | WR | — |
| Conflicts | `/roadsync/conflicts` | RoadSync | same | `roadsync.conflict.read` | Scoped | **P0** | Queue | Open HIGH | Conflicts | Severity chips |
| Conflict detail | `/roadsync/conflicts/[id]` | RoadSync | same | `roadsync.conflict.read` | Resource | **P0** | Resolve | Respond / Resolve | Conflict | Map sheet |
| Coordination inbox | `/roadsync/coordination` | RoadSync | AO, GA | `roadsync.coordination.read` | Agency/org | **P0** | Pending responses | Respond | Requests | Cards |
| InfraMap | `/map` | InfraMap | Staff | `map.view.internal` | Layer ACL | **P0** | GIS | Select feature | Viewport GeoJSON | Bottom sheet |
| Contractors | `/contractors` | Contractor | GA, AO, PM, SA | `contractor.read` | Scoped | P1 | Find firms | Manage | Contractors | Cards |
| Contractor detail | `/contractors/[id]` | Contractor | same | `contractor.read` | Resource | P1 | Profile | Assign | Profile+projects | Tabs |
| Assets | `/assets` | Assets | Staff | `asset.read` | Scoped | P1 | Register | Open | Assets | Cards |
| Asset detail | `/assets/[id]` | Assets | same | `asset.read` | Resource | P1 | Condition | Add maintenance | Asset | Tabs |
| Documents hub | `/documents` | DocTrace | Staff | `document.read` | Scoped | P1 | Cross-project files | Upload | Docs | Filters sheet |
| Inspections hub | `/inspections` | Inspection | IN primary; PM/GA | `inspection.read` | Assigned/scope | P1 | Inspector inbox | Open due | Inspections | Cards |
| Inspection detail | `/inspections/[id]` | Inspection | IN | `inspection.submit` / read | Assigned | P1 | Verify | Submit report | Inspection | Evidence uploader |
| Issues inbox | `/issues` | Citizen | AO, GA, SA | `citizen_issue.read` | Agency/org | P1 | Handle reports | Assign | Issues | Cards |
| Issue detail | `/issues/[id]` | Citizen | same + own | `citizen_issue.update` | Resource | P1 | Close loop | Update status | Issue | — |
| Notifications | `/notifications` | Notify | All staff | `notification.read` | Own | **P0** | Catch up | Mark read | Notifications | List |
| Reports | `/reports` | Reports | GA, AO, PM, SA | `report.view` | Scoped | P1 | Insights | Export if allowed | Aggregates | Tabs not extra URLs |
| Profile | `/profile` | Identity | All staff | `profile.read` | Own | **P0** | Account | Save | User | Form |
| Settings | `/settings` | Identity | All staff | `notification.preference.update` | Own | P1 | Prefs only — **not** system admin | Save | Prefs | — |

Contractor/Inspector see **subset** of these URLs; others 403/404 per [route-access-policy.md](../security/route-access-policy.md).

---

## Administration

| Page | Route | Permission | Scope | Priority | Actions | Audit |
|------|-------|------------|-------|----------|---------|-------|
| Admin home | `/admin` | redirect | — | **P0** | — | — |
| Users | `/admin/users` | `user.read` / `user.create` | Platform / org | **P0** | Provision, disable | Yes |
| Agencies | `/admin/agencies` | `agency.manage` or read | Platform / org | **P0** | CRUD catalog | Yes |
| Roles | `/admin/roles` | `role.read` / `role.manage` | Platform | P1 | View; SA manage | Yes |
| Audit logs | `/admin/audit-logs` | `audit.read` | Platform / org | **P0** | Read/export P1 | N/A (read-only) |
| System | `/admin/system` | `system.manage` | Platform | P1 | Settings | Yes |

GA: users/agencies/audit **org-scoped** only; no `system.manage`.

---

## Errors

| Page | Route | Notes |
|------|-------|-------|
| Forbidden | `/403` | Capability denied; CTA Dashboard or Home |
| Not found | `/404` | Also IDOR; no existence leak |
| Server | `/500` | Generic; retry |
| Maintenance | `/maintenance` | Static; no API secrets |

Next.js `error.tsx` should match `/500` tone. Never dump stacks.
