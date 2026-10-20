import { cn } from "cn";

import { InfraosMark } from "@/components/landing/infraos-mark";
import { LandingSectionPhoto } from "@/components/landing/landing-section-photo";
import { buttonVariants } from "@/components/ui/button";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { HERO_OVERVIEW_ANCHOR, SOLUTION_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function LandingHero({ copy }: { copy: PublicLandingCopy }) {
  const primaryCtaHref = `#${SOLUTION_SECTION_ANCHOR}`;

  return (
    <section aria-labelledby="hero-heading" className="border-b border-border bg-background">
      <div className="container-dashboard gutter-page public-section-pad grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
        <div className="flex min-w-0 flex-col gap-5">
          <p className="inline-flex items-center gap-2 type-label text-link">
            <InfraosMark className="size-6" />
            {copy.hero.eyebrow}
          </p>
          <h1 id="hero-heading" className="type-display text-balance text-text-primary">
            {copy.hero.title}
          </h1>
          <p className="type-body max-w-prose text-text-secondary">{copy.hero.lead}</p>
          <p className="type-body-small max-w-prose text-text-secondary">{copy.hero.modules}</p>
          <p className="public-demo-callout type-caption text-text-secondary">{copy.hero.prototypeNote}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a href={primaryCtaHref} className={cn(buttonVariants({ size: "lg" }), "h-auto whitespace-normal")}>
              {copy.hero.ctaPrimaryLabel}
            </a>
          </div>
        </div>
        <div id={HERO_OVERVIEW_ANCHOR} className="scroll-mt-28" tabIndex={-1}>
          <LandingSectionPhoto
            photoId="southernExpressway"
            alt={copy.photography.lifecycleExpresswayAlt}
            credit={copy.photography.lifecycleExpresswayCredit}
            aspectClassName="aspect-[16/10]"
            priority
          />
        </div>
      </div>
    </section>
  );
}
