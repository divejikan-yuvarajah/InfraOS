import Link from "next/link";
import Image from "next/image";
import { LandmarkIcon, LockIcon } from "lucide-react";

import type { LpCopy } from "@/lib/landing/lp-copy";
import type { LpLinks } from "@/lib/landing/lp-data";
import type { PublicInfoSlug, PublicLocale } from "@/lib/landing/locales";

import { NavLink } from "./atoms";
import { LpLanguageNav } from "./lp-language-nav";
import { LpMobileMenu } from "./lp-mobile-menu";

/** Utility bar and primary navigation. Fixed, matching the design export. */
export function LpHeader({
  copy,
  links,
  locale,
  infoSlug,
}: {
  copy: LpCopy["nav"];
  links: LpLinks;
  locale: PublicLocale;
  infoSlug?: PublicInfoSlug;
}) {
  const noticesHref = infoSlug ? `${links.home === "/" ? "" : links.home}#status-panel` : "#status-panel";
  return (
    <header className="lp-header">
      <div className="lp-util">
        <div className="lp-container lp-util__inner">
          <div className="lp-util__who">
            <span className="lp-util__crest-wrap">
              <LandmarkIcon aria-hidden="true" width={13} height={13} />
            </span>
            <span className="lp-util__text">{copy.affiliation}</span>
            <span className="lp-util__sep" aria-hidden="true">
              •
            </span>
            <span className="lp-util__sub">{copy.ministry}</span>
          </div>
          <div className="lp-util__right">
            <div className="lp-util__links">
              <Link href={noticesHref} className="lp-util__link">
                {copy.publicNotices}
              </Link>
              <Link href={links.contact} className="lp-util__link">
                {copy.helpdesk}
              </Link>
            </div>
            <LpLanguageNav locale={locale} label={copy.languageLabel} infoSlug={infoSlug} />
          </div>
        </div>
      </div>
      <div className="lp-container lp-nav__inner">
        <Link href={links.home} className="lp-brand" aria-label="INFRAOS">
          <div className="lp-brand__mark-wrap">
            <Image
              src="/brand/infraos-icon-transparent.png"
              alt="InfraOS"
              width={40}
              height={40}
              priority
              className="lp-brand__mark-img"
            />
          </div>
          <span>
            <span className="lp-brand__name">INFRAOS</span>
            <span className="lp-brand__tag">National Infrastructure Coordination</span>
          </span>
        </Link>
        <nav aria-label={copy.label} className="lp-nav__links">
          <NavLink href={links.home} current={!infoSlug} className="lp-navlink">
            {copy.home}
          </NavLink>
          <NavLink href={links.about} current={infoSlug === "about"} className="lp-navlink">
            {copy.about}
          </NavLink>
          <NavLink href={links.howItWorks} current={infoSlug === "how-it-works"} className="lp-navlink">
            {copy.howItWorks}
          </NavLink>
          <NavLink href={links.faq} current={infoSlug === "faq"} className="lp-navlink">
            {copy.faq}
          </NavLink>
          <NavLink href={links.contact} current={infoSlug === "contact"} className="lp-navlink">
            {copy.contact}
          </NavLink>
        </nav>
        <div className="lp-nav__actions">
          <Link href={links.signIn} className="lp-signin">
            <LockIcon aria-hidden="true" width={15} height={15} />
            <span>{copy.signIn}</span>
          </Link>
          <LpMobileMenu copy={copy} links={links} locale={locale} infoSlug={infoSlug} />
        </div>
      </div>
    </header>
  );
}

