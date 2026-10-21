import { RoadsyncInfographic } from "@/components/landing/roadsync-infographic";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { SOLUTION_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function RoadsyncSignatureSection({ copy }: { copy: PublicLandingCopy }) {
  const rs = copy.roadsyncSignature;

  return (
    <section
      id={SOLUTION_SECTION_ANCHOR}
      aria-labelledby="roadsync-signature-heading"
      className="cf-roadsync-section scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page cf-roadsync-section__inner">
        <header className="cf-roadsync-section__header max-w-prose">
          <p className="cf-roadsync-section__eyebrow">{rs.eyebrow}</p>
          <h2 id="roadsync-signature-heading" className="cf-roadsync-section__title text-balance">
            {rs.title}
          </h2>
          <p className="cf-roadsync-section__intro">{rs.intro}</p>
        </header>
        <RoadsyncInfographic copy={copy} />
      </div>
    </section>
  );
}
