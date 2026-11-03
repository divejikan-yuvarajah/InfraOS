import {
  BotIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  FileCheckIcon,
  MapIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import type { LpCopy } from "@/lib/landing/lp-copy";
import { LP_ANCHORS, type LpLinks } from "@/lib/landing/lp-data";

import { SectionHeader } from "./atoms";

const ICONS: readonly LucideIcon[] = [ClipboardListIcon, CalendarDaysIcon, MapIcon, BotIcon, FileCheckIcon];

export function CoreCapabilitiesSection({ copy, links }: { copy: LpCopy["capabilities"]; links: LpLinks }) {
  return (
    <section id={LP_ANCHORS.capabilities} className="lp-section lp-section--canvas" aria-labelledby="lp-capabilities-title">
      <div className="lp-container">
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} id="lp-capabilities-title" wide />
        <ul className="lp-grid5" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {copy.cards.map((card, index) => {
            const Icon = ICONS[index];
            return (
              <li key={card.name} style={{ display: "flex" }}>
                <Link href={links.capabilities[index]} className="lp-tile" style={{ width: "100%" }}>
                  <div>
                    <div className="lp-tile__icon">
                      <Icon aria-hidden="true" />
                    </div>
                    <h3 className="lp-display lp-h3">{card.name}</h3>
                    <p className="lp-tile__text">{card.text}</p>
                  </div>
                  <span className="lp-tile__link">
                    {card.link}
                    <ChevronRightIcon aria-hidden="true" />
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

