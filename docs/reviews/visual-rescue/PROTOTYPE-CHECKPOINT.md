# Visual rescue — Phase B prototype checkpoint

**Branch:** `feature/public-landing-visual-rescue`  
**Scope (approved gate only):** header + photography-led hero + signature RoadSync section on the public homepage.  
**Status:** Awaiting owner visual approval before Phase C (remaining sections).

## Baseline diagnosis (top defects)

1. **Hero** — split white column + small bordered photo; not a documentary first fold (`landing-hero.tsx`).
2. **Brand** — modest mark + inline text; weak hierarchy (`infraos-mark.tsx`, header).
3. **Navigation** — five equal-weight top links (`getPublicNavLinks` before rescue).
4. **RoadSync story** — small diagram inside dark band; still reads as a card widget (`infraos-solution-section.tsx`).
5. **Repetition** — problem / features / lifecycle / audiences remain card grids (unchanged in this checkpoint).
6. **Rhythm** — long runs of white `bg-surface` sections with similar padding.
7. **Utility row** — disclaimer competes with nav instead of supporting a strong hero disclosure.
8. **CTA** — generic “How INFRAOS works” vs. concrete coordination story.
9. **Photography** — hero image treated as a side figure, not the anchor.
10. **Mobile** — text-first stack without immersive crop (`public-section-pad` grid).

## Prototype changes (what visitors should see)

| Area | Before | After |
|------|--------|--------|
| Header | Light bar, 5 links, small mark | Dark ink bar, **4** links, larger intersection mark + stacked wordmark |
| Hero | White 50/50 grid | **Full-bleed Seeduwa construction photo**, gradient wash, route linework, headline on image |
| RoadSync | Dark section + compact diagram | Light editorial band + **corridor map strip + dual timelines + overlap callout** (synthetic labels) |

## Screenshots

| File | Description |
|------|-------------|
| `baseline-desktop-1440.png` | Pre-rescue homepage (copy in temp screenshots folder; duplicate here when captured) |
| `prototype-desktop-1440.png` | Post-rescue homepage desktop |
| `prototype-mobile-375.png` | Post-rescue homepage mobile |

## Verify locally

```bash
npm run dev:web
# Open http://localhost:3000/ (or the port Next prints)
```

Hard-refresh if an older dev server was already running.

## Tests (prototype batch)

Run: `npm run type-check`, `npm run test`, `npm run lint`, `npm run build` from `apps/web`.

## Owner decision required

Reply **approve prototype** to proceed with Phase C (problem narrative, capabilities, lifecycle route, GIS, audiences, FAQ, footer, supporting pages under the same identity).

Reply **revise** with what still feels like the old site (hero, diagram, header, type, photography).

**No commit / push / merge** until you instruct.
