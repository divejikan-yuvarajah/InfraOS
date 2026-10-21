import type { PublicLandingCopy } from "@/lib/landing/messages";
import { TRUST_SECTION_ANCHOR } from "@/lib/landing/faq-items";

export function TrustInformationSection({ copy }: { copy: PublicLandingCopy }) {
  const trust = copy.trust;

  return (
    <section
      id={TRUST_SECTION_ANCHOR}
      aria-labelledby="trust-heading"
      className="cf-trust-section scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page cf-trust-section__inner">
        <div className="cf-trust-ribbon">
          <span className="cf-trust-ribbon__mark">INFRAOS</span>
          <span className="cf-trust-ribbon__tag">{trust.ribbonLabel}</span>
        </div>

        <header className="max-w-prose space-y-3">
          <p className="cf-gis-section__eyebrow">{trust.eyebrow}</p>
          <h2 id="trust-heading" className="cf-gis-section__title text-balance">
            {trust.title}
          </h2>
          <p className="cf-gis-section__intro">{trust.intro}</p>
        </header>

        <ul className="cf-trust-grid list-none p-0 m-0 mt-8">
          {trust.points.map((point) => (
            <li key={point.id}>
              <article className="cf-trust-card">
                <h3 className="cf-trust-card__title">{point.title}</h3>
                <p className="cf-trust-card__body">{point.body}</p>
              </article>
            </li>
          ))}
        </ul>

        <p className="cf-trust-notice">{trust.demoNotice}</p>
        <p className="cf-audiences-staff-note mt-3">{trust.humanReviewNote}</p>
      </div>
    </section>
  );
}
