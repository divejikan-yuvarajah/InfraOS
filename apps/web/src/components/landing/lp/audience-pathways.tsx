import { ArrowRightIcon, CompassIcon, GlobeIcon, HardHatIcon, LandmarkIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";

import type { LpCopy } from "@/lib/landing/lp-copy";
import { LP_ANCHORS, type LpLinks } from "@/lib/landing/lp-data";

import { FigureCaption, SectionHeader } from "./atoms";

const ICONS: readonly LucideIcon[] = [GlobeIcon, LandmarkIcon, HardHatIcon];

export function AudiencePathways({ copy, links }: { copy: LpCopy["audiences"]; links: LpLinks }) {
  const hrefs = [links.howItWorks, links.signIn, links.signIn];
  return (
    <section id={LP_ANCHORS.audiences} className="lp-section lp-section--canvas" aria-labelledby="lp-audiences-title">
      <div className="lp-container">
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} id="lp-audiences-title" wide />
        <FigureCaption
          src="/landing/lp/qa-inspection.jpg"
          alt={copy.imageAlt}
          sizes="(min-width: 1280px) 1184px, 100vw"
          label={copy.plateLabel}
          caption={copy.plateCaption}
          chip={copy.plateChip}
          ChipIcon={CompassIcon}
          dot="var(--lp-success)"
        />
        <ul className="lp-grid3" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {copy.cards.map((card, index) => {
            const Icon = ICONS[index];
            return (
              <li key={card.title} style={{ display: "flex" }}>
                <Link href={hrefs[index]} className="lp-tile lp-tile--audience" style={{ width: "100%" }}>
                  <div>
                    <div className="lp-tile__icon lp-tile__icon--round">
                      <Icon aria-hidden="true" />
                    </div>
                    <div className="lp-tile__tag">{card.tag}</div>
                    <h3 className="lp-display lp-h3" style={{ marginTop: 4 }}>
                      {card.title}
                    </h3>
                    <p className="lp-tile__text" style={{ marginTop: 8 }}>
                      {card.text}
                    </p>
                  </div>
                  <span className="lp-tile__link">
                    {card.cta}
                    <ArrowRightIcon aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

