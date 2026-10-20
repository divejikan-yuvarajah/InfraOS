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
      <div className="container-dashboard gutter-page public-section-pad grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
        <header className="max-w-prose space-y-3">
          <p className="type-label text-link">{preview.eyebrow}</p>
          <h2 id="preview-heading" className="type-section-title text-balance text-text-primary">
            {preview.title}
          </h2>
          <p className="type-body text-text-secondary">{preview.intro}</p>
          <p className="public-demo-callout type-body-small text-text-primary">{preview.disclaimer}</p>
          <p className="type-body-small text-text-secondary">{preview.statusNote}</p>
        </header>
        <CoordinationPreviewFigure copy={copy} />
      </div>
    </section>
  );
}
