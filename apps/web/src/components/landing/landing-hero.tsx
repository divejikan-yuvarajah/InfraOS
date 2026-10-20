import Image from "next/image";
import { cn } from "cn";

import { InfraosMark } from "@/components/landing/infraos-mark";
import { buttonVariants } from "@/components/ui/button";
import { LANDING_PHOTO_PATHS } from "@/lib/landing/landing-photos";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { HERO_OVERVIEW_ANCHOR, SOLUTION_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function LandingHero({ copy }: { copy: PublicLandingCopy }) {
  const primaryCtaHref = `#${SOLUTION_SECTION_ANCHOR}`;

  return (
    <section aria-labelledby="hero-heading" className="public-rescue-hero">
      <div className="public-rescue-hero__media" aria-hidden>
        <Image
          src={LANDING_PHOTO_PATHS.expresswayConstructionSeeduwa}
          alt={copy.photography.problemExpresswayAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div className="public-rescue-hero__wash" aria-hidden />
      <svg
        className="public-rescue-hero__routes"
        viewBox="0 0 1200 400"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 280 C200 240, 400 320, 600 260 S1000 300, 1200 240"
          fill="none"
          stroke="#FF5B00"
          strokeWidth="2"
          opacity="0.7"
        />
        <path
          d="M0 320 C250 360, 500 280, 750 340 S1050 300, 1200 360"
          fill="none"
          stroke="#FEB600"
          strokeWidth="1.5"
          strokeDasharray="8 6"
          opacity="0.5"
        />
      </svg>

      <div className="public-rescue-hero__content container-dashboard gutter-page">
        <div id={HERO_OVERVIEW_ANCHOR} className="public-rescue-hero__panel scroll-mt-28" tabIndex={-1}>
          <p className="inline-flex items-center gap-2 type-label text-[#FEB600]">
            <InfraosMark className="size-8" />
            {copy.hero.eyebrow}
          </p>
          <h1 id="hero-heading" className="public-rescue-hero__title mt-4 text-balance">
            {copy.hero.title}
          </h1>
          <p className="type-body mt-4 max-w-prose text-slate-200">{copy.hero.lead}</p>
          <p className="mt-3 max-w-prose rounded-md border border-white/20 bg-black/25 px-3 py-2 type-caption text-slate-200">
            {copy.hero.prototypeNote}
          </p>
          <a
            href={primaryCtaHref}
            className={cn(buttonVariants({ size: "lg" }), "public-rescue-hero__cta h-auto whitespace-normal")}
          >
            {copy.hero.ctaPrimaryLabel}
          </a>
          <p className="public-rescue-hero__credit">{copy.photography.problemExpresswayCredit}</p>
        </div>
      </div>
    </section>
  );
}
