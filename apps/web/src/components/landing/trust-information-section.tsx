import type { PublicLandingCopy } from "@/lib/landing/messages";
import { TRUST_SECTION_ANCHOR } from "@/lib/landing/faq-items";

export function TrustInformationSection({ copy }: { copy: PublicLandingCopy }) {
  const trust = copy.trust;

  return (
    <section
      id={TRUST_SECTION_ANCHOR}
      aria-labelledby="trust-heading"
      className="scroll-mt-28 border-b border-border bg-surface"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page py-12 md:py-16">
        <header className="mx-auto max-w-prose space-y-3">
          <p className="type-label text-link">{trust.eyebrow}</p>
          <h2 id="trust-heading" className="type-section-title text-balance text-text-primary">
            {trust.title}
          </h2>
          <p className="type-body text-text-secondary">{trust.intro}</p>
        </header>

        <ul className="mx-auto mt-8 max-w-prose list-none space-y-4 p-0">
          {trust.points.map((point) => (
            <li key={point.id} className="rounded-lg border border-border bg-background p-4">
              <h3 className="type-card-title text-text-primary">{point.title}</h3>
              <p className="type-body-small mt-2 text-text-secondary">{point.body}</p>
            </li>
          ))}
        </ul>

        <p className="type-body-small mx-auto mt-8 max-w-prose rounded-md border border-border bg-muted/40 px-3 py-2 text-text-primary">
          {trust.demoNotice}
        </p>
      </div>
    </section>
  );
}
