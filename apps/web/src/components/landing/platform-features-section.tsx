import type { PublicLandingCopy } from "@/lib/landing/messages";
import { FEATURES_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function PlatformFeaturesSection({ copy }: { copy: PublicLandingCopy }) {
  const { features } = copy;
  const spotlightIds = new Set(["projecttrace", "roadsync"]);
  const spotlight = features.items.filter((item) => spotlightIds.has(item.id));
  const roadmap = features.items.filter((item) => !spotlightIds.has(item.id));

  return (
    <section
      id={FEATURES_SECTION_ANCHOR}
      aria-labelledby="features-heading"
      className="scroll-mt-28 border-b border-border bg-[#f8fafc]"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad">
        <header className="max-w-prose space-y-3">
          <p className="type-label text-link">{features.eyebrow}</p>
          <h2 id="features-heading" className="type-section-title text-balance text-text-primary">
            {features.title}
          </h2>
          <p className="type-body text-text-secondary">{features.intro}</p>
        </header>

        <div className="public-capabilities-spotlight mt-12">
          {spotlight.map((item) => (
            <article
              key={item.id}
              className={
                item.id === "roadsync"
                  ? "public-capability-spotlight-panel public-capability-spotlight-panel--roadsync"
                  : "public-capability-spotlight-panel"
              }
            >
              <p className="type-label text-link" lang="en">
                {item.moduleName}
              </p>
              <h3 className="type-card-title mt-2 text-text-primary">
                {item.title}
                <span className="type-caption ms-2 font-normal text-text-muted">
                  {item.status === "demonstration"
                    ? features.statusDemonstration
                    : features.statusPlanned}
                </span>
              </h3>
              <p className="type-body mt-3 text-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>

        <div className="public-capabilities-roadmap mt-10">
          <p className="type-label text-text-primary">{features.statusPlanned}</p>
          <ul className="mt-4 space-y-4">
            {roadmap.map((item) => (
              <li key={item.id} className="grid gap-1 border-s border-border ps-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
                <span className="type-label text-text-primary" lang="en">
                  {item.moduleName}
                </span>
                <div>
                  <p className="type-body-small text-text-secondary">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="type-body-small mt-8 max-w-prose text-text-secondary">{features.disclosure}</p>
      </div>
    </section>
  );
}
