import Link from "next/link";

import type { LpCopy } from "@/lib/landing/lp-copy";
import { LP_ANCHORS, type LpLinks } from "@/lib/landing/lp-data";
import type { PublicInfoSlug, PublicLocale } from "@/lib/landing/locales";

import { LpLanguageNav } from "./lp-language-nav";

export function CivicFooter({
  copy,
  nav,
  stages,
  links,
  locale,
  infoSlug,
}: {
  copy: LpCopy["footer"];
  nav: LpCopy["nav"];
  stages: LpCopy["lifecycle"]["stages"];
  links: LpLinks;
  locale: PublicLocale;
  infoSlug?: PublicInfoSlug;
}) {
  const homeAnchor = (id: string) => (infoSlug ? `${links.home === "/" ? "" : links.home}#${id}` : `#${id}`);
  const platformHrefs = [
    homeAnchor(LP_ANCHORS.capabilities),
    homeAnchor(LP_ANCHORS.capabilities),
    homeAnchor(LP_ANCHORS.capabilities),
    homeAnchor(LP_ANCHORS.incident),
    homeAnchor(LP_ANCHORS.capabilities),
  ];
  const serviceHrefs = [
    homeAnchor(LP_ANCHORS.dispatch),
    homeAnchor(LP_ANCHORS.problem),
    links.contact,
    links.contact,
    homeAnchor(LP_ANCHORS.incident),
  ];
  const governanceHrefs = [
    links.about,
    links.howItWorks,
    homeAnchor(LP_ANCHORS.lifecycle),
    links.howItWorks,
    homeAnchor(LP_ANCHORS.transparency),
  ];

  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer__strip">
          <div className="lp-footer__striphead">
            <span className="lp-footer__stripk">{copy.lifecycleTitle}</span>
            <span className="lp-footer__stripn">{copy.lifecycleNote}</span>
          </div>
          <ol className="lp-footer__stages">
            {stages.map((stage, index) => (
              <li key={stage.name} className="lp-footer__stage">
                <b>
                  {String(index + 1).padStart(2, "0")}. {stage.name}
                </b>
                <span>{stage.tag}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="lp-footer__cols">
          <nav aria-label={copy.platformTitle}>
            <h3>{copy.platformTitle}</h3>
            <ul>
              {copy.platformLinks.map((label, index) => (
                <li key={label}>
                  <Link href={platformHrefs[index]}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={copy.servicesTitle}>
            <h3>{copy.servicesTitle}</h3>
            <ul>
              {copy.servicesLinks.map((label, index) => (
                <li key={label}>
                  <Link href={serviceHrefs[index]}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={copy.governanceTitle}>
            <h3>{copy.governanceTitle}</h3>
            <ul>
              {copy.governanceLinks.map((label, index) => (
                <li key={label}>
                  <Link href={governanceHrefs[index]}>{label}</Link>
                </li>
              ))}
              <li>
                <Link href={links.faq}>{nav.faq}</Link>
              </li>
            </ul>
          </nav>
          <div>
            <h3>{copy.contactTitle}</h3>
            <p className="lp-footer__contact-unit">{copy.contactUnit}</p>
            <p>{copy.contactAgency}</p>
            <p>{copy.contactAddress}</p>
            <p style={{ marginTop: "0.5rem" }}>{copy.contactText}</p>
            <p className="lp-footer__meta">{copy.slaNote}</p>
            <p className="lp-footer__meta">{copy.gazetteRef}</p>
            <p style={{ marginTop: "0.25rem" }}>
              <Link href={links.contact}>{copy.contactLink}</Link>
            </p>
          </div>
        </div>
        <div className="lp-footer__bottom">
          <div className="lp-footer__legal">
            <span>{copy.rights}</span>
            <Link href={links.privacy}>{copy.privacy}</Link>
            <Link href={links.accessibility}>{copy.accessibility}</Link>
          </div>
          <div className="lp-footer__lang">
            <span style={{ color: "var(--lp-muted)" }}>{copy.languageLabel}:</span>
            <LpLanguageNav locale={locale} label={copy.languageLabel} infoSlug={infoSlug} className="lp-lang--footer" />
          </div>
        </div>
      </div>
    </footer>
  );
}

