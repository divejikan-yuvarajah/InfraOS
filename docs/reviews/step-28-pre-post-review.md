# Step 28 — Infrastructure lifecycle presentation

**Branch:** `feature/public-landing-core`  
**Anchor:** `#how-it-works`  
**Native review:** Sinhala/Tamil lifecycle + photo alt/credits — **unverified draft**

## Representation

- Eight canonical stages (`plan` → `maintain`) in DOM order via semantic `<ol>` with eight `<li>` items.
- Visual pairing: two-column grid on `md+`; single column on narrow viewports (no horizontal scroll).
- Distinct from Step 26 three-step solution flow (coordination intro vs full lifecycle).

## Files

- `components/landing/infrastructure-lifecycle-section.tsx`
- `lib/landing/lifecycle-stages.ts`
- `lib/landing/landing-lifecycle.test.ts`
- `lib/landing/messages.ts` (`lifecycle`, `nav.lifecycle`)
- `lib/landing/navigation.ts` (`HOW_IT_WORKS_SECTION_ANCHOR`)
- `components/landing/public-home.tsx`

## Step 28 result

**COMPLETE** (code + automated checks). Manual viewport/axe pass documented in Step 27 polish section of this delivery report.

**Step 29:** Not started (awaiting approval).
