import { LandingSectionPhoto } from "@/components/landing/landing-section-photo";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { PROBLEM_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function InfrastructureProblemSection({ copy }: { copy: PublicLandingCopy }) {
  const narrativeCards = copy.problem.cards.slice(0, 3);

  return (
    <section
      id={PROBLEM_SECTION_ANCHOR}
      aria-labelledby="problem-heading"
      className="public-problem-section scroll-mt-28 border-b border-border"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div className="public-problem-section__story min-w-0 space-y-6">
            <header className="max-w-prose space-y-3">
              <p className="type-label text-link">{copy.problem.eyebrow}</p>
              <h2 id="problem-heading" className="type-section-title text-balance text-text-primary">
                {copy.problem.title}
              </h2>
              <p className="type-body text-text-secondary">{copy.problem.intro}</p>
            </header>
            <ol className="space-y-4">
              {narrativeCards.map((card, index) => (
                <li key={card.id}>
                  <p className="type-caption text-text-muted">
                    {String(index + 1).padStart(2, "0")} · {card.badge}
                  </p>
                  <h3 className="type-card-title mt-1 text-text-primary">{card.title}</h3>
                  <p className="type-body-small mt-1 text-text-secondary">{card.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <LandingSectionPhoto
            photoId="southernExpressway"
            alt={copy.photography.lifecycleExpresswayAlt}
            credit={copy.photography.lifecycleExpresswayCredit}
            aspectClassName="aspect-[16/10]"
            editorial
            className="lg:max-w-none"
          />
        </div>
      </div>
    </section>
  );
}
