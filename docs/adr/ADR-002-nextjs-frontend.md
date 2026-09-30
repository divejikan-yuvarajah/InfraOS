# ADR-002 — Next.js Frontend

**Status:** Accepted  
**Step:** 02  
**Date:** 2026-09-30

## Context

INFRAOS needs a professional web UI: marketing pages, authenticated dashboards, and a GIS map. The course stack specifies Next.js.

## Decision

Use **Next.js (App Router) + React + TypeScript**.

Supporting UI stack: Tailwind CSS, shadcn/ui, React Hook Form, Zod, TanStack Query, Zustand (narrow), MapLibre, GSAP only on marketing/story surfaces.

## Reasons

- App Router layouts match public vs authenticated shells
- TypeScript aligns with the Express API
- RSC for mostly static public pages; Client Components for map/forms/dashboard
- Strong Vercel deployment fit

## Alternatives considered

| Alternative | Why not |
|-------------|---------|
| Pages Router | No existing app to preserve; App Router is current default |
| Vite SPA only | Weaker conventions for layouts/SEO/public portal |
| Remix | Not the locked course stack |

## Trade-offs

- Server/client boundary has a learning curve
- Must not put secrets or Mongo in Next.js server actions as a second backend — **Express remains the API**

## Consequences

- Next.js may proxy to Express in dev
- Authorization still enforced on Express
- No Redux

## Future revisit conditions

- If Next.js server actions become a documented BFF **in a new ADR** — not by accident
