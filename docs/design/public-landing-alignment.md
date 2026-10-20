# Public landing alignment (after Steps 25–26)

**Branch:** `feature/public-landing-core`  
**Scope:** Public pages only. Operational shell, tokens for dashboards, and Step 23 fixtures are unchanged except that Noto Sinhala/Tamil are now loaded as fallbacks already named in Step 18.

## What changed

- Service-first English hero and a persistent university-demonstration banner.
- Language switch: English at `/`, Sinhala at `/si`, Tamil at `/ta`. Anchors `#problem`, `#solution`, `#hero-overview` stay on the current page.
- Staff sign-in is **not** shown. No authentication route exists yet.
- No photograph was added. No licensed Sri Lankan infrastructure image is in the repo.

## Translations

Sinhala and Tamil strings are **unverified drafts** (`PUBLIC_TRANSLATION_STATUS = unverified-draft`). They are not certified localization. Native-speaker review is still required.

## Imagery

| Asset | Status |
| --- | --- |
| Hero photograph | Not used |
| License / owner / attribution | Not applicable until an approved file is added |
| Current visual | Existing labeled SVG coordination example |

Do not scrape government websites for photos.

## Source brief

The research directive lives at `Prompts/INFRAOS_Public_Landing_Government_Design_Research_and_Cursor_Directive.md` (it was not present under `docs/design/` when this alignment started).
