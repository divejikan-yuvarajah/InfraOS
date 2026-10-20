import type { ReactNode } from "react";
import Link from "next/link";

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
  const className =
    "type-body-small text-text-secondary underline-offset-4 hover:text-text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

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

  const quickLinks: { href: string; label: string; external?: boolean }[] = [
    { href: footerLinkHref(locale, "about"), label: footer.linkAbout },
    { href: footerLinkHref(locale, "coordination"), label: footer.linkCoordination },
    { href: footerLinkHref(locale, "faq"), label: footer.linkFaq },
    { href: footerLinkHref(locale, "accessibility"), label: footer.linkAccessibility },
    { href: footerLinkHref(locale, "privacy"), label: footer.linkPrivacy },
    {
      href: footerLinkHref(locale, "photoCredits"),
      label: footer.linkPhotoCredits,
      external: true,
    },
  ];

  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-dashboard gutter-page space-y-8 py-10">
        <div className="space-y-2">
          <p className="type-label text-text-primary">{footer.identityTitle}</p>
          <p className="type-body-small max-w-prose text-text-secondary">{footer.identityLine}</p>
        </div>

        <nav aria-label={footer.navLabel}>
          <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
            {quickLinks.map((item) => (
              <li key={item.href}>
                <FooterLink href={item.href} external={item.external}>
                  {item.label}
                </FooterLink>
              </li>
            ))}
          </ul>
        </nav>

        <PublicLanguageNav
          locale={locale}
          label={footer.languageLabel}
          infoSlug={infoSlug ?? null}
        />

        <div className="space-y-3 border-t border-border pt-6">
          <p className="type-body-small max-w-prose text-text-secondary">{footer.disclosure}</p>
          <p className="type-caption text-text-muted">
            © {year} {footer.copyrightPrefix}
          </p>
          <p className="type-caption max-w-prose text-text-muted">{copy.translationDraftNote}</p>
        </div>
      </div>
    </footer>
  );
}
