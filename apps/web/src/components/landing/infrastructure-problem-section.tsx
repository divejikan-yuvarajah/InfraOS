import { LandingSectionPhoto } from "@/components/landing/landing-section-photo";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { PROBLEM_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function InfrastructureProblemSection({ copy }: { copy: PublicLandingCopy }) {
  return (
    <section
      id={PROBLEM_SECTION_ANCHOR}
      aria-labelledby="problem-heading"
      className="scroll-mt-28 border-b border-border bg-surface"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-14">
        <LandingSectionPhoto
          photoId="expresswayConstructionSeeduwa"
          alt={copy.photography.problemExpresswayAlt}
          credit={copy.photography.problemExpresswayCredit}
          aspectClassName="aspect-[4/3]"
        />
        <div className="min-w-0 space-y-6">
          <header className="max-w-prose space-y-3">
            <p className="type-label text-link">{copy.problem.eyebrow}</p>
            <h2 id="problem-heading" className="type-section-title text-balance text-text-primary">
              {copy.problem.title}
            </h2>
            <p className="type-body text-text-secondary">{copy.problem.intro}</p>
          </header>
          <ol className="space-y-5 border-s border-border ps-5">
            {copy.problem.cards.map((card, index) => (
              <li key={card.id} className="min-w-0">
                <p className="type-caption text-text-muted">
                  {String(index + 1).padStart(2, "0")} · {card.badge}
                </p>
                <h3 className="type-card-title mt-1 text-text-primary">{card.title}</h3>
                <p className="type-body-small mt-2 text-text-secondary">{card.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
