import { ArrowRightIcon, BadgeCheckIcon, SearchIcon } from "lucide-react";
import Link from "next/link";

import type { LpCopy } from "@/lib/landing/lp-copy";
import { LP_ANCHORS } from "@/lib/landing/lp-data";

import { FigureCaption, StatPill } from "./atoms";

export function HeroSection({ copy }: { copy: LpCopy["hero"] }) {
  return (
    <section id={LP_ANCHORS.hero} className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-container">
        <div className="lp-hero__grid">
          <div>
            <div className="lp-hero__badge">
              <span className="lp-dot" style={{ background: "var(--lp-orange)" }} aria-hidden="true" />
              {copy.badge}
            </div>
            <h1 id="lp-hero-title" className="lp-display lp-h1">
              {copy.title}
            </h1>
            <p className="lp-hero__lede">{copy.lede}</p>
            <div className="lp-hero__actions">
              <Link href={`#${LP_ANCHORS.capabilities}`} className="lp-btn lp-btn--primary">
                {copy.ctaPrimary}
                <ArrowRightIcon aria-hidden="true" width={18} height={18} />
              </Link>
              <Link href={`#${LP_ANCHORS.transparency}`} className="lp-btn lp-btn--secondary">
                <SearchIcon aria-hidden="true" width={18} height={18} />
                {copy.ctaSecondary}
              </Link>
            </div>
            <div className="lp-hero__stats">
              {copy.stats.map((stat) => (
                <StatPill key={stat.value} {...stat} />
              ))}
            </div>
          </div>
          <div className="lp-hero__figwrap">
            <div className="lp-hero__frame">
              <FigureCaption
                hero
                priority
                src="/landing/lp/hero-coordination.jpg"
                alt={copy.imageAlt}
                sizes="(min-width: 1280px) 590px, (min-width: 1024px) 45vw, 100vw"
                label={copy.figLabel}
                title={copy.figTitle}
                caption={copy.figCaption}
                chip={copy.figChip}
                dot="var(--lp-success)"
              />
            </div>
            <div className="lp-hero__calibrated">
              <BadgeCheckIcon aria-hidden="true" />
              <div>
                <strong>{copy.calibratedTitle}</strong>
                <span>{copy.calibratedNote}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

