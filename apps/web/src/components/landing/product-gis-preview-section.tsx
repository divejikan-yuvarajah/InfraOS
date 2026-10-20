import { CoordinationPreviewFigure } from "@/components/landing/coordination-preview-figure";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { PREVIEW_SECTION_ANCHOR } from "@/lib/landing/preview-data";

export function ProductGisPreviewSection({ copy }: { copy: PublicLandingCopy }) {
  const preview = copy.preview;

  return (
    <section
      id={PREVIEW_SECTION_ANCHOR}
      aria-labelledby="preview-heading"
      className="scroll-mt-28 border-b border-border bg-background"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page py-12 md:py-16">
        <header className="mx-auto max-w-prose space-y-3">
          <p className="type-label text-link">{preview.eyebrow}</p>
          <h2 id="preview-heading" className="type-section-title text-balance text-text-primary">
            {preview.title}
          </h2>
          <p className="type-body text-text-secondary">{preview.intro}</p>
          <p className="type-body-small rounded-md border border-border bg-muted/40 px-3 py-2 text-text-primary">
            {preview.disclaimer}
          </p>
        </header>

        <div className="mx-auto mt-8 max-w-3xl">
          <CoordinationPreviewFigure copy={copy} />
        </div>

        <p className="type-body-small mx-auto mt-6 max-w-prose text-text-secondary">
          {preview.statusNote}
        </p>
      </div>
    </section>
  );
}
