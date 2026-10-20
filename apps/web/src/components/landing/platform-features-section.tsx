import type { PublicLandingCopy } from "@/lib/landing/messages";
import { FEATURES_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function PlatformFeaturesSection({ copy }: { copy: PublicLandingCopy }) {
  const { features } = copy;

  return (
    <section
      id={FEATURES_SECTION_ANCHOR}
      aria-labelledby="features-heading"
      className="scroll-mt-28 border-b border-border bg-surface"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad">
        <header className="mx-auto max-w-prose space-y-3">
          <p className="type-label text-link">{features.eyebrow}</p>
          <h2 id="features-heading" className="type-section-title text-balance text-text-primary">
            {features.title}
          </h2>
          <p className="type-body text-text-secondary">{features.intro}</p>
        </header>

        <div className="mt-12 space-y-10">
          {features.items.map((item) => (
            <article key={item.id} className="grid gap-3 border-t border-border pt-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
              <p className="type-label text-text-primary">
                <span lang="en">{item.moduleName}</span>
              </p>
              <div className="min-w-0 space-y-2">
                <h3 className="type-card-title text-text-primary">
                  {item.title}
                  <span className="type-caption ms-3 font-normal text-text-muted">
                    {item.status === "demonstration"
                      ? features.statusDemonstration
                      : features.statusPlanned}
                  </span>
                </h3>
                <p className="type-body max-w-prose text-text-secondary">{item.body}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="type-body-small mx-auto mt-8 max-w-prose text-text-secondary">
          {features.disclosure}
        </p>
      </div>
    </section>
  );
}
