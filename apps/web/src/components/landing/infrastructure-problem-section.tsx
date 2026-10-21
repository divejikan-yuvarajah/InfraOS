import Image from "next/image";
import { CalendarRange, MapPin, Shovel } from "lucide-react";

import { LANDING_PHOTO_PATHS } from "@/lib/landing/landing-photos";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { PROBLEM_SECTION_ANCHOR } from "@/lib/landing/navigation";

const FACT_ICONS = [MapPin, CalendarRange, Shovel] as const;

export function InfrastructureProblemSection({ copy }: { copy: PublicLandingCopy }) {
  const facts = copy.problem.cards.slice(0, 3);

  return (
    <section
      id={PROBLEM_SECTION_ANCHOR}
      aria-labelledby="problem-heading"
      className="cf-problem-section scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page cf-problem-section__inner">
        <div className="cf-problem-section__visual">
          <figure className="cf-problem-section__figure">
            <div className="cf-problem-section__photo">
              <Image
                src={LANDING_PHOTO_PATHS.expresswayConstructionSeeduwa}
                alt={copy.photography.problemExpresswayAlt}
                fill
                sizes="(max-width: 1023px) 100vw, 46vw"
                className="object-cover object-[center_45%]"
              />
              <div className="cf-problem-section__photo-accent" aria-hidden />
            </div>
            <figcaption className="cf-problem-section__credit">
              {copy.photography.problemExpresswayCredit}
            </figcaption>
          </figure>
          <div className="cf-problem-section__flow-card" aria-hidden>
            <span className="cf-problem-section__flow-road" />
            <span className="cf-problem-section__flow-pipe" />
            <p className="cf-problem-section__flow-label">{copy.problem.flowLabel}</p>
          </div>
        </div>

        <div className="cf-problem-section__story min-w-0">
          <header className="cf-problem-section__header">
            <p className="cf-problem-section__eyebrow">{copy.problem.eyebrow}</p>
            <h2 id="problem-heading" className="cf-problem-section__title text-balance">
              {copy.problem.title}
            </h2>
            <p className="cf-problem-section__intro">{copy.problem.intro}</p>
            <p className="cf-problem-section__callout">{copy.problem.callout}</p>
          </header>

          <ul className="cf-problem-section__facts">
            {facts.map((fact, index) => {
              const Icon = FACT_ICONS[index] ?? MapPin;
              return (
                <li key={fact.id} className={`cf-problem-fact cf-problem-fact--${fact.variant}`}>
                  <span className="cf-problem-fact__icon" aria-hidden>
                    <Icon strokeWidth={1.75} />
                  </span>
                  <div className="cf-problem-fact__copy">
                    <p className="cf-problem-fact__badge">{fact.badge}</p>
                    <h3 className="cf-problem-fact__title">{fact.title}</h3>
                    <p className="cf-problem-fact__body">{fact.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
