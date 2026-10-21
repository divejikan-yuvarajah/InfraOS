# Public landing photography manifest

**Last updated:** Connected Future Batch 2A (2026-10-21)  
**Scope:** Public marketing pages only (`/`, `/si`, `/ta`).

All images are stored under `apps/web/public/landing/photos/`. They are used for **context and trust** only—not to imply that INFRAOS demonstration data is an official government record or a specific national project.

## Images in use

| Local file | Section / anchor | Creator | License | Wikimedia source |
| --- | --- | --- | --- | --- |
| `expressway-construction-seeduwa.jpg` | **Hero (primary)** + Problem (`#problem`) | Rehman Abubakr | [CC BY-SA](https://creativecommons.org/licenses/by-sa/3.0/) (Commons upload; share-alike) | [ConstructionE03-January2012-01.JPG](https://commons.wikimedia.org/wiki/File:ConstructionE03-January2012-01.JPG) |
| `southern-expressway-sri-lanka.jpg` | Lifecycle (`#how-it-works`) | Dinesh De Alwis | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | [Southern_Expressway_Highway_Sri_Lanka.JPG](https://commons.wikimedia.org/wiki/File:Southern_Expressway_Highway_Sri_Lanka.JPG) |
| `road-construction-wilpattu.jpg` | Manifest reserve (not in current hero) | Rehman Abubakr | CC BY-SA (Commons) | [RoadConstruction-Wilpattu-January2012-01.JPG](https://commons.wikimedia.org/wiki/File:RoadConstruction-Wilpattu-January2012-01.JPG) |

**Attribution on site:** Short credit lines under each figure (localized in `messages.ts` → `photography.*Credit`). Full table also at [`/landing/photo-credits.html`](../../apps/web/public/landing/photo-credits.html).

**Alt text:** Localized in `photography.problemExpresswayAlt` and `photography.lifecycleExpresswayAlt` for en / si / ta (draft; native review pending).

## Technical notes

- Derivatives: 1280px-wide JPEGs from Wikimedia thumb URLs where originals exceeded ~1.5 MB.
- Rendering: `next/image` via `LandingSectionPhoto` with explicit width/height and responsive `sizes`.
- No hotlinking to Wikimedia in production HTML.

## Compliance checklist

- [x] License verified on Wikimedia file pages before download
- [x] No copyrighted government portal screenshots
- [x] No watermarked stock imagery
- [x] Manifest + public credits page
- [ ] Native-speaker review of localized alt/credit wording (pending)
