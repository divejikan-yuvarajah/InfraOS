# Mission Control UI: Known limitations

For the pull request description.

- **Sinhala and Tamil strings are English-only in places and unreviewed.** Existing Sinhala and Tamil copy is still draft pending native review. Strings added in this work (the review "no action available" message and the dashboard "Not available in this view" caption) have no Sinhala or Tamil translation and show in English in every locale.
- **Deferred items are not built:** the horizontal milestone strip on project detail, the `Ctrl+K` go-to menu, the collapsed icon rail, the density toggle, and the sticky mobile action bar on forms.
- **Dark theme is a specification only.** See `docs/design/mission-control-dark-theme-spec.md`. No switcher exists.
- **Future modules are documented, not built.** See `docs/design/future-module-patterns.md`.
- **Physical vs financial progress** still renders as two labelled text rows with bars. The richer dual-bar component with a "Provisional" tag on the progress page is not built.
- **Demo only:** the demo uses a throwaway in-memory database, and a Next dev server (webpack mode) because production builds refuse live login against a localhost API by design.
- **Not independently verified:** screen-reader behaviour was not tested with a real screen reader. Colour contrast was judged visually and from the token set, not measured with a tool. Production readiness remains BLOCKED.
