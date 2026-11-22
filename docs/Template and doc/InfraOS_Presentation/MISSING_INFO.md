# Missing information — team to provide before recording

| # | Item | Where it appears | Why it matters |
|---|---|---|---|
| 1 | Lecturer name | Slide 1 `[LECTURER — TEAM TO CONFIRM]` | Title slide identity |
| 2 | Agreed contribution percentages (total 100 %) | Slide 25, contribution-matrix.md `[TBC]` | Must be team-confirmed; not computed from git |
| 3 | Explanation of git authorship (588 commits under one member, none under the other four) | Slide 21 | Examiners will ask; answer honestly (shared machine? pair work? non-code work?) |
| 4 | Each member's concrete deliverables (files/screens they personally built or tested) | Slides 11–20, 25 | The draft module split follows the proposal, not verified authorship |
| 5 | Confirmation of the speaker allocation for shared sections (security → Thasneem, testing → Janethri, deployment → Sanojan) | Slides 2, 22–24 | DRAFT allocation, chosen so every member speaks more than once |
| 6 | Recording language / any member presenting in Sinhala or Tamil | Script | Script is English only |
| 7 | Fresh screenshots of the real (non-showcase) public pages with demo data, if wanted | Slide 17 uses the live empty report form | Avoid `/portal/public` (hard-coded figures) |
| 8 | Whether to correct the PDF report (see feature-inventory.md "Corrections needed") | — | The report and the deck currently disagree on citizen/risk APIs and stack |

Not run (v3): web production build and browser E2E. Lint, type-check and ai-service pytest were run on 2026-11-22 (see slide 24).

## v3 updates (2026-11-22)
| # | Item | Where | Note |
|---|---|---|---|
| 9 | **Unresolved authorship question** — git shortlog lists commits under one member's account (+ Copilot bot). Team must agree how work is attributed **before recording**. Check whether members committed under other emails/names and add a `.mailmap` if so (would change shortlog grouping — evidence only). | Slide 22, contribution-matrix.md | Slide 22 now uses neutral wording ("evidence, team to confirm") |
| 10 | Confirm the rebalanced **speaker split** (draft): Divejikan 5:30 · Nuha 4:40 · Thasneem 4:35 · Janethri 4:25 · Sanojan 4:15 | Slide 3, script | Mandatory intros: Divejikan s1, Thasneem s6, Sanojan s7, Janethri s8, Nuha s9 |
| 11 | **6 images still needed** (placeholders on slides): s02-github, s09-compass, s10-compass-doc, s22-github-prs, s24-actions, s25-render | SCREENSHOT_SHOT_LIST.md | Drop PNGs into `_presentation_build/assets/images/user/` and rebuild |
| 12 | Main deck file was open in PowerPoint during the build, so v3 was saved as `InfraOS_Technical_Presentation_v3.pptx`. Close PowerPoint and re-run `build_deck.py` to also write the main filename. | — | v2 backup: `InfraOS_Technical_Presentation_v2_backup.pptx` |

## Known doc discrepancies (report PDF vs code) — not shown on slides
- Report §5.1 names Mapbox/Leaflet and Vercel; code uses **MapLibre GL** and **Render**.
- Appendix B says citizen-issue endpoints and AI-risk API are "not implemented"; both exist (`/public/issues`, `/issues/*`, `/risk/*`).
- Appendix C marks "all five members have attributable code" as Verified; git shortlog does not show this (item 9).
- npm workspaces are `apps/web`, `apps/api`, `packages/*`; `apps/ai-service` is a separate Python app (the v2 ledger said otherwise; corrected in v3).
- The live **public landing page** shows marketing figures ("14 Agencies", "38% Cost Cut", "Ministry of Infrastructure & Transport", "Permit Cleared") and `/portal/public` hard-codes "LKR 4.82B / −38%". Neither is API data; neither is used as evidence. The project rules forbid fabricated figures — owner should decide whether to change them (landing pages are out of scope unless asked).
- `docs/Screen/10-staff-dashboard.png` shows illustrative metrics (e.g. "38,412 audit events", "1.8M events") — excluded from the deck.

## v4 updates (2026-11-22)
| # | Item | Note |
|---|---|---|
| 13 | **3 login-only captures still needed**: slide 9 Compass collection list (`s09-compass`), slide 10 Compass `conflicts` document (`s10-compass-doc`), slide 25 Render dashboard (`s25-render`) | See SCREENSHOT_SHOT_LIST.md; hide connection strings, cluster/IP, emails, env values |
| 14 | Slide 22 numbers now come from the public GitHub pages (598 commits on main, 83 branches, 224 closed PRs, 118 CI runs). The earlier local-clone figures (595 commits, 168 refs, 211 PR numbers) are superseded: the clone was not fully fetched and `git branch -a` counted local + remote-tracking refs twice | Ledger rows V1/V4 updated |
| 15 | The per-author `git shortlog` image was removed from the deck (v4). Authorship is for the team to settle; see #9 | contribution-matrix.md |
| 16 | **Photo licences (share-alike):** 4 Wikimedia Commons photos are used only as cropped, duotone-tinted atmosphere bands — Sājidh Buhary (CC BY-SA 4.0), Rehman Abubakr (CC BY-SA 4.0), Yomal Indula Perera (CC BY-SA 4.0), Dennis Sylvester Hurd (CC BY 2.0). Credits are on each opener slide and on slide 28. Keep them if the deck is shared | image-manifest.csv has author, URL and licence per photo |
| 17 | Web production build and browser E2E were **not executed**: a build writes `.next` into the repository folder, which is read-only for this deck. Slide 24 says "Not executed" with the reason | Run them yourselves if you want the tile to turn green |
| 18 | The public landing page still shows illustrative figures ("14 Agencies", "38% Cost Cut"); the landing-page screenshot is not used | Owner decision |
