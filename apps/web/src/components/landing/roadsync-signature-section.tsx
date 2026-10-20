import { RoadsyncCorridorExplainer } from "@/components/landing/roadsync-corridor-explainer";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { SOLUTION_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function RoadsyncSignatureSection({ copy }: { copy: PublicLandingCopy }) {
  const rs = copy.roadsyncSignature;

  return (
    <section
      id={SOLUTION_SECTION_ANCHOR}
      aria-labelledby="roadsync-signature-heading"
      className="public-roadsync-section scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad public-roadsync-section__inner">
        <header className="max-w-prose space-y-4">
          <p className="type-label text-link">{rs.eyebrow}</p>
          <h2 id="roadsync-signature-heading" className="type-section-title text-balance text-text-primary">
            {rs.title}
          </h2>
          <p className="type-body text-text-secondary">{rs.intro}</p>
          <ul className="space-y-2">
            {rs.callouts.map((item) => (
              <li key={item.id} className="border-s-2 border-link ps-3 type-body-small text-text-secondary">
                <strong className="font-medium text-text-primary">{item.title}</strong>
                {" — "}
                {item.body}
              </li>
            ))}
          </ul>
        </header>
        <RoadsyncCorridorExplainer copy={copy} />
      </div>
    </section>
  );
}
