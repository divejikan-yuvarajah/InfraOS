import { cn } from "cn";

import { HeroCoordinationIllustration } from "@/components/landing/hero-coordination-illustration";
import { buttonVariants } from "@/components/ui/button";
import { HERO_OVERVIEW_ANCHOR, SOLUTION_SECTION_ANCHOR } from "@/lib/landing/navigation";
import { PUBLIC_HERO } from "@/lib/landing/public-content";

export function LandingHero() {
  const primaryCtaHref = `#${SOLUTION_SECTION_ANCHOR}`;

  return (
    <section
      aria-labelledby="hero-heading"
      className="border-b border-border bg-background"
    >
      <div className="container-dashboard gutter-page grid gap-10 py-10 md:py-14 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-16">
        <div className="flex flex-col gap-5">
          <p className="type-label text-infra-orange">{PUBLIC_HERO.eyebrow}</p>
          <h1 id="hero-heading" className="type-display text-text-primary">
            {PUBLIC_HERO.title}
          </h1>
          <p className="type-body max-w-prose text-text-secondary">{PUBLIC_HERO.lead}</p>
          <p className="type-body-small max-w-prose text-text-secondary">
            {PUBLIC_HERO.modules}
          </p>
          <p className="type-caption text-text-muted">{PUBLIC_HERO.prototypeNote}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={primaryCtaHref}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              {PUBLIC_HERO.ctaPrimaryLabel}
            </a>
          </div>
        </div>

        <div
          id={HERO_OVERVIEW_ANCHOR}
          className="scroll-mt-24 lg:scroll-mt-28"
          tabIndex={-1}
        >
          <HeroCoordinationIllustration />
        </div>
      </div>
    </section>
  );
}
