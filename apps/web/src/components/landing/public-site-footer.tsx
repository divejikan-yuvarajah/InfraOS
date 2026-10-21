import type { ReactNode } from "react";
import Link from "next/link";

import { InfraosWordmark } from "@/components/landing/infraos-wordmark";
import { PublicLanguageNav } from "@/components/landing/public-language-nav";
import { footerLinkHref } from "@/lib/landing/public-info-pages";
import type { PublicInfoSlug } from "@/lib/landing/locales";
import type { PublicLocale } from "@/lib/landing/locales";
import type { PublicLandingCopy } from "@/lib/landing/messages";

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const className = "public-motion-interactive";

  if (external) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function PublicSiteFooter({
  copy,
  locale,
  infoSlug,
}: {
  copy: PublicLandingCopy;
  locale: PublicLocale;
  infoSlug?: PublicInfoSlug | null;
}) {
  const year = new Date().getFullYear();
  const footer = copy.footer;

  const exploreLinks = [
    { href: footerLinkHref(locale, "about"), label: footer.linkAbout },
    { href: footerLinkHref(locale, "coordination"), label: footer.linkCoordination },
    { href: footerLinkHref(locale, "faq"), label: footer.linkFaq },
  ];

  const informationLinks = [
    { href: footerLinkHref(locale, "contact"), label: footer.linkContact },
    { href: footerLinkHref(locale, "accessibility"), label: footer.linkAccessibility },
    { href: footerLinkHref(locale, "privacy"), label: footer.linkPrivacy },
    {
      href: footerLinkHref(locale, "photoCredits"),
      label: footer.linkPhotoCredits,
      external: true,
    },
  ];

  return (
    <footer className="cf-footer">
      <div className="container-dashboard gutter-page cf-footer__inner">
        <div>
          <InfraosWordmark tone="on-dark" markSize="size-9" />
          <p className="cf-footer__mission">{footer.identityLine}</p>
        </div>

        <nav aria-label={footer.navLabel}>
          <p className="cf-footer__col-title">{footer.navExploreTitle}</p>
          <ul className="cf-footer__links">
            {exploreLinks.map((item) => (
              <li key={item.href}>
                <FooterLink href={item.href}>{item.label}</FooterLink>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={footer.navInformationTitle}>
          <p className="cf-footer__col-title">{footer.navInformationTitle}</p>
          <ul className="cf-footer__links">
            {informationLinks.map((item) => (
              <li key={item.href}>
                <FooterLink href={item.href} external={item.external}>
                  {item.label}
                </FooterLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="cf-footer__bottom">
          <PublicLanguageNav
            locale={locale}
            label={footer.languageLabel}
            infoSlug={infoSlug ?? null}
            className="[&_a]:text-slate-300 [&_a:hover]:text-white [&_span[aria-current]]:text-white"
          />
          <p className="cf-footer__disclosure">{footer.disclosure}</p>
          <p className="cf-footer__meta">
            © {year} {footer.copyrightPrefix}
          </p>
          <p className="cf-footer__meta">{copy.translationDraftNote}</p>
        </div>
      </div>
    </footer>
  );
}
