# Public landing core (Steps 25–29) — progress

| Step | Status | Notes |
| --- | --- | --- |
| 25 | Merged (`main` / `development`) | Header, nav, hero — PR lineage #26/#28 |
| 26 | Merged | `#problem`, `#solution` |
| 27 | Merged (PR #30 @ `ac9e31f`) | `#features`, licensed photography, manifest |
| 28 | Merged (PR #30 @ `ac9e31f`) | `#how-it-works`, 8-stage lifecycle en/si/ta |
| 29 | **Complete (local, uncommitted)** | `#audiences`, benefits + 4 groups en/si/ta draft |

**Group PR to `development`:** Ready for **team review** once Step 29 commit is approved — see PR template below.

**Branch:** `feature/public-landing-core` @ `ac9e31f` + Step 29 working tree.

**Native Sinhala/Tamil review:** Pending for all public copy including Step 29 audience block.

---

## Suggested group PR: `feature/public-landing-core` → `development`

### Summary

- **Step 25:** Government-style public shell, trilingual routes, demo disclosure, safe nav.
- **Step 26:** Problem/solution sections with honest coordination narrative.
- **Step 27:** Platform functions (`#features`), CC-licensed Sri Lankan infrastructure photos + manifest/credits.
- **Step 28:** Eight-stage lifecycle (`#how-it-works`), synthetic scenario labeling, RoadSync as human-review-only wording.
- **Step 29:** Public audiences & intended benefits (`#audiences`), no login CTAs, in-page links only.

### Test plan

- [ ] `npm run test:web`, `type-check:web`, `lint:web`, `build:web`
- [ ] `/`, `/si`, `/ta` — all nav anchors including `#audiences`
- [ ] Locale switch preserves section intent; si/ta expansion on mobile
- [ ] No links to `/login`, admin, or unimplemented features
- [ ] Photo credits page + manifest match deployed assets
- [ ] Footer/demo banner visible; no official government claims
- [ ] Responsive spot-check 320–1280; keyboard focus on nav and audience links
- [ ] Native-speaker sign-off for si/ta (explicit gate)

### Copy / photo approval gates

- [ ] English public copy (product owner)
- [ ] Sinhala draft reviewed by qualified native speaker
- [ ] Tamil draft reviewed by qualified native speaker
- [ ] Photography manifest and Wikimedia attributions approved

**Do not merge to `main` without separate stable checkpoint policy.**
