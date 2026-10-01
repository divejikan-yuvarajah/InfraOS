# INFRAOS Dashboard Information Architecture

**Document:** `/docs/ux/dashboard-information-architecture.md`  
**Step:** 05  
**Status:** Locked  
Charts only if they explain a decision. Role widgets below.

---

## Super Admin

Platform health (users, agencies), audit highlights, **read-only** conflict/project counts. No approve/pay widgets.

---

## Government Admin

- Project counts by status (org)
- Delayed / high-risk (P1 risk)
- Budget overview (org)
- Open conflicts
- **Pending approvals**
- Recent activity

---

## Agency Officer

- Agency active projects
- Work requests
- RoadSync conflicts affecting agency
- Pending coordination
- Citizen issues assigned

---

## Project Manager

- Assigned projects
- Milestone deadlines
- Physical progress
- Open tasks (submit, documents)
- Risks (P1)

---

## Contractor

- Assigned projects
- Progress due
- Requested evidence
- Upcoming dates  
No org-wide charts.

---

## Inspector

- Inspections due
- Pending verification
- Recent activity

---

## Citizen

No `/dashboard`. Public home is the landing page.

---

## States

Loading skeletons per widget. Empty: “No pending approvals.” Error per widget with retry — one failed widget must not blank the page.
