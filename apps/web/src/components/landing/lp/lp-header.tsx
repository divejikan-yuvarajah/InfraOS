import Link from "next/link";
import { LandmarkIcon, LockIcon } from "lucide-react";

import { InfraosMark } from "@/components/landing/infraos-mark";
import type { LpCopy } from "@/lib/landing/lp-copy";
import type { LpLinks } from "@/lib/landing/lp-data";
import type { PublicLocale } from "@/lib/landing/locales";

import { NavLink } from "./atoms";
import { LpLanguageNav } from "./lp-language-nav";
import { LpMobileMenu } from "./lp-mobile-menu";

/** Utility bar and primary navigation. Fixed, matching the design export. */
export function LpHeader({ copy, links, locale }: { copy: LpCopy["nav"]; links: LpLinks; locale: PublicLocale }) {
  return (
    <header className="lp-header">
      <div className="lp-util">
        <div className="lp-container lp-util__inner">
          <div className="lp-util__who">
            <LandmarkIcon aria-hidden="true" width={16} height={16} style={{ color: "var(--lp-primary)", flexShrink: 0 }} />
            <span className="lp-util__text">{copy.affiliation}</span>
            <span className="lp-util__sep" aria-hidden="true">
              |
            </span>
            <span className="lp-util__sub">{copy.ministry}</span>
          </div>
          <div className="lp-util__right">
            <div className="lp-util__links">
              <Link href="#status-panel" className="lp-util__link">
                {copy.publicNotices}
              </Link>
              <Link href={links.contact} className="lp-util__link">
                {copy.helpdesk}
              </Link>
            </div>
            <LpLanguageNav locale={locale} label={copy.languageLabel} />
          </div>
        </div>
      </div>
      <div className="lp-container lp-nav__inner">
        <Link href={links.home} className="lp-brand" aria-label="INFRAOS">
          <InfraosMark className="lp-brand__mark" variant="light" />
          <span>
            <span className="lp-brand__name">INFRAOS</span>
            <span className="lp-brand__tag">National Infrastructure Coordination</span>
          </span>
        </Link>
        <nav aria-label={copy.label} className="lp-nav__links">
          <NavLink href={links.home} current className="lp-navlink">
            {copy.home}
          </NavLink>
          <NavLink href={links.about} className="lp-navlink">
            {copy.about}
          </NavLink>
          <NavLink href={links.howItWorks} className="lp-navlink">
            {copy.howItWorks}
          </NavLink>
          <NavLink href={links.faq} className="lp-navlink">
            {copy.faq}
          </NavLink>
          <NavLink href={links.contact} className="lp-navlink">
            {copy.contact}
          </NavLink>
        </nav>
        <div className="lp-nav__actions">
          <Link href={links.signIn} className="lp-signin">
            <LockIcon aria-hidden="true" width={16} height={16} />
            <span>{copy.signIn}</span>
          </Link>
          <LpMobileMenu copy={copy} links={links} locale={locale} />
        </div>
      </div>
    </header>
  );
}

