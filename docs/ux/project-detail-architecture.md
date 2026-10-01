# INFRAOS Project Detail Architecture

**Document:** `/docs/ux/project-detail-architecture.md`  
**Step:** 05  
**Status:** Locked  
**Owner:** ProjectTrace (team leader)

`/projects/[id]` → `/projects/[id]/overview`.

---

## 1. Persistent project header (all tabs)

```text
Project code · Title · Status badge · Agency · Manager · Contractor (if any)
Key actions: Edit | Submit | (GA) Approve — only if permission + state
```

Load **once** (TanStack Query `project.core`). Tabs must not each refetch the full aggregate independently.

---

## 2. Tab navigation

```text
Overview | Timeline | Milestones | Documents | Finance | Inspections | Risks
```

Hide Finance without `finance.budget.read`. Hide Risks without `risk.read`. Hide Documents without `document.read`.

Deep links keep the tab in the path (not only query) so refresh works.

---

## 3. Overview

Summaries only: location mini-map, dates, progress vs financial (if allowed), open conflicts count, next milestone, last inspection. Links into tabs — do not duplicate full tables.

---

## 4. Mobile

Header compact; tabs in a **scrollable tablist** or select. Actions in a sheet.

---

## 5. Empty / error

Each tab has its own empty copy (“No documents uploaded.” + Upload if allowed). AI tab: fallback when FastAPI is down.
