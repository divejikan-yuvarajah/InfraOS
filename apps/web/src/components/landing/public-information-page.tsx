import type { Metadata } from "next";
import Link from "next/link";

import { PublicSiteFooter } from "@/components/landing/public-site-footer";
import { PublicSiteHeader } from "@/components/landing/public-site-header";
import { MAIN_CONTENT_ID } from "@/lib/accessibility/document-landmarks";
import {
  publicHomePath,
  publicInfoPath,
  type PublicInfoSlug,
  type PublicLocale,
} from "@/lib/landing/locales";
import { getPublicCopy, type PublicInfoPageCopy } from "@/lib/landing/messages";

export function publicInformationMetadata(
  locale: PublicLocale,
  slug: PublicInfoSlug,
): Metadata {
  const copy = getPublicCopy(locale);
  const page = copy.infoPages[slug];
  const canonical = publicInfoPath(locale, slug);

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: {
      canonical,
      languages: {
        en: publicInfoPath("en", slug),
        si: publicInfoPath("si", slug),
        ta: publicInfoPath("ta", slug),
        "x-default": publicInfoPath("en", slug),
      },
    },
  };
}

function InfoSections({ page }: { page: PublicInfoPageCopy }) {
  return (
    <div>
      {page.sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`${section.id}-heading`}
          className="cf-info-page__section"
        >
          <h2 id={`${section.id}-heading`}>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </div>
  );
}

export function PublicInformationPage({
  locale,
  slug,
}: {
  locale: PublicLocale;
  slug: PublicInfoSlug;
}) {
  const copy = getPublicCopy(locale);
  const page = copy.infoPages[slug];

  return (
    <div lang={locale} className="public-site public-connected-future flex min-h-full flex-1 flex-col">
      <PublicSiteHeader locale={locale} copy={copy} connectedFuture infoSlug={slug} />
      <main
        id={MAIN_CONTENT_ID}
        lang={locale}
        tabIndex={-1}
        className="cf-info-page flex min-w-0 flex-1 flex-col scroll-mt-28 outline-none"
      >
        <article className="container-dashboard gutter-page public-section-pad">
          <header className="cf-info-page__banner max-w-prose space-y-4">
            <p className="type-caption text-text-muted">
              <Link
                href={publicHomePath(locale)}
                className="text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {copy.nav.home}
              </Link>
            </p>
            <h1 className="cf-info-page__title">{page.title}</h1>
            <p className="type-body-lead text-text-secondary">{page.intro}</p>
          </header>
          <InfoSections page={page} />
        </article>
      </main>
      <PublicSiteFooter copy={copy} locale={locale} infoSlug={slug} />
    </div>
  );
}
