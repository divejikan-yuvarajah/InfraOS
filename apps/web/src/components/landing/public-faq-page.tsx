import type { Metadata } from "next";
import Link from "next/link";

import { LandingFaqSection } from "@/components/landing/landing-faq-section";
import { PublicSiteFooter } from "@/components/landing/public-site-footer";
import { PublicSiteHeader } from "@/components/landing/public-site-header";
import { MAIN_CONTENT_ID } from "@/lib/accessibility/document-landmarks";
import { publicHomePath, type PublicLocale } from "@/lib/landing/locales";
import { getPublicCopy } from "@/lib/landing/messages";
import { publicInformationMetadata } from "@/components/landing/public-information-page";

export function publicFaqMetadata(locale: PublicLocale): Metadata {
  return publicInformationMetadata(locale, "faq");
}

export function PublicFaqPage({ locale }: { locale: PublicLocale }) {
  const copy = getPublicCopy(locale);
  const page = copy.infoPages.faq;

  return (
    <div lang={locale} className="public-site public-connected-future flex min-h-full flex-1 flex-col">
      <PublicSiteHeader locale={locale} copy={copy} connectedFuture infoSlug="faq" />
      <main
        id={MAIN_CONTENT_ID}
        lang={locale}
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col scroll-mt-28 outline-none"
      >
        <div className="container-dashboard gutter-page pt-10">
          <header className="mb-2 max-w-prose space-y-4">
            <p className="type-caption text-text-muted">
              <Link
                href={publicHomePath(locale)}
                className="text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {copy.nav.home}
              </Link>
            </p>
            <h1 className="cf-info-page__title">{page.title}</h1>
            <p className="type-body text-text-secondary">{page.intro}</p>
          </header>
        </div>
        <LandingFaqSection copy={copy} locale={locale} showFullPageLink={false} />
      </main>
      <PublicSiteFooter copy={copy} locale={locale} infoSlug="faq" />
    </div>
  );
}
