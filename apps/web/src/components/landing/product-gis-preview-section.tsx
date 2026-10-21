import { CoordinationPreviewFigure } from "@/components/landing/coordination-preview-figure";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { PREVIEW_SECTION_ANCHOR } from "@/lib/landing/preview-data";

export function ProductGisPreviewSection({ copy }: { copy: PublicLandingCopy }) {
  const preview = copy.preview;

  return (
    <section
      id={PREVIEW_SECTION_ANCHOR}
      aria-labelledby="preview-heading"
      className="cf-gis-section scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page cf-gis-section__inner">
        <header className="min-w-0 space-y-3">
          <p className="cf-gis-section__eyebrow">{preview.eyebrow}</p>
          <h2 id="preview-heading" className="cf-gis-section__title text-balance">
            {preview.title}
          </h2>
          <p className="cf-gis-section__intro">{preview.intro}</p>
          <p className="cf-gis-badge">
            <span className="cf-gis-badge__dot" aria-hidden />
            {preview.syntheticBadge}
          </p>
          <p className="type-body-small text-text-secondary">{preview.statusNote}</p>
        </header>

        <div className="min-w-0">
          <CoordinationPreviewFigure copy={copy} />
          <p className="mt-3 type-body-small text-text-muted">{preview.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
