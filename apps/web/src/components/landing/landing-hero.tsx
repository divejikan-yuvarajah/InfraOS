import Image from "next/image";
import Link from "next/link";

import { HeroCoordinationOverlay } from "@/components/landing/hero-coordination-overlay";
import { LANDING_PHOTO_PATHS } from "@/lib/landing/landing-photos";
import { publicInfoPath, type PublicLocale } from "@/lib/landing/locales";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { HERO_OVERVIEW_ANCHOR, SOLUTION_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function LandingHero({
  copy,
  locale,
}: {
  copy: PublicLandingCopy;
  locale: PublicLocale;
}) {
  const primaryCtaHref = `#${SOLUTION_SECTION_ANCHOR}`;
  const secondaryCtaHref = publicInfoPath(locale, "how-it-works");

  return (
    <section aria-labelledby="hero-heading" className="cf-hero">
      <div className="cf-hero__accent-line" aria-hidden />

      <div className="cf-hero__stage container-dashboard gutter-page">
        <div
          id={HERO_OVERVIEW_ANCHOR}
          className="cf-hero__content scroll-mt-28"
          tabIndex={-1}
        >
          <p className="cf-hero__eyebrow">{copy.hero.eyebrow}</p>
          <h1 id="hero-heading" className="cf-hero__title text-balance">
            {copy.hero.title}
          </h1>
          <p className="cf-hero__lead">{copy.hero.lead}</p>
          <div className="cf-hero__actions">
            <a href={primaryCtaHref} className="cf-hero__cta cf-hero__cta--primary">
              {copy.hero.ctaPrimaryLabel}
            </a>
            <Link href={secondaryCtaHref} className="cf-hero__cta cf-hero__cta--secondary">
              {copy.hero.ctaSecondaryLabel}
            </Link>
          </div>
          <p className="cf-hero__note">{copy.hero.prototypeNote}</p>
        </div>

        <div className="cf-hero__visual">
          <div className="cf-hero__photo">
            <Image
              src={LANDING_PHOTO_PATHS.expresswayConstructionSeeduwa}
              alt={copy.photography.heroConstructionAlt}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 54vw"
              className="object-cover object-[center_42%]"
            />
            <div className="cf-hero__photo-scrim" aria-hidden />
            <HeroCoordinationOverlay className="cf-hero__overlay" />
          </div>
          <p className="cf-hero__credit">{copy.photography.heroConstructionCredit}</p>
        </div>
      </div>
    </section>
  );
}
