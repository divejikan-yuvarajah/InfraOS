# Step 27 — Public feature / service overview

**Branch:** `feature/public-landing-core`  
**Anchor:** `#features`  
**Native review:** Sinhala/Tamil — **unverified draft** (same as Steps 25–26 alignment)

## Feature inventory (public landing copy)

| Module | Status on this site |
| --- | --- |
| ProjectTrace | Demonstration concept (no linked workspace) |
| RoadSync | Demonstration concept (deterministic rules described) |
| InfraMap | Planned capability (no map UI) |
| Inspections & assets | Planned capability |
| Public information | Planned capability (no public project/report routes) |

## Files

- `components/landing/platform-features-section.tsx`
- `lib/landing/messages.ts` (en/si/ta `features` + `nav.features`)
- `lib/landing/navigation.ts` (`FEATURES_SECTION_ANCHOR`, nav link)
- `components/landing/public-home.tsx`
- `lib/landing/landing-features.test.ts`

**Photos (Step 27 polish):** Two Wikimedia Commons images (CC BY-SA) — problem + lifecycle sections. See `docs/design/public-landing-photography-manifest.md`.

**Manual QA (2026-10-20):** Browser spot-check at 375px mobile emulation on `/`, `/si`; anchor `#how-it-works`; language nav; heading order h1→h2→h3 observed in accessibility tree. **axe-core CLI:** see delivery report. **Playwright:** NOT RUN (not in repo).

**Native review:** Sinhala/Tamil — still **pending** (draft only).
