import type { Metadata } from "next";
import Link from "next/link";

import { AboutPage } from "@/components/landing/lp/about-page";
import { ContactPage } from "@/components/landing/lp/contact-page";
import { LpSubpageShell } from "@/components/landing/lp/lp-subpage-shell";
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {page.sections.map((section, idx) => (
        <section
          key={section.id}
          aria-labelledby={`${section.id}-heading`}
          className="lp-card"
          style={{ padding: "1.75rem" }}
        >
          <div className="lp-eyebrow" style={{ marginBottom: "0.35rem" }}>
            SECTION 0{idx + 1}
          </div>
          <h2
            id={`${section.id}-heading`}
            className="lp-serif"
            style={{ fontSize: "1.4rem", color: "var(--lp-text)", margin: "0 0 0.65rem" }}
          >
            {section.heading}
          </h2>
          <p
            style={{
              fontSize: "0.9375rem",
              lineHeight: 1.65,
              color: "var(--lp-text-secondary)",
              margin: 0,
            }}
          >
            {section.body}
          </p>
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
  if (slug === "about") {
    return <AboutPage locale={locale} />;
  }

  if (slug === "contact") {
    return <ContactPage locale={locale} />;
  }

  const copy = getPublicCopy(locale);
  const page = copy.infoPages[slug];

  return (
    <LpSubpageShell locale={locale} infoSlug={slug}>
      <section className="lp-subhero" aria-labelledby="info-page-heading">
        <div className="lp-container">
          <nav className="lp-breadcrumb" aria-label="Breadcrumb">
            <Link
              href={publicHomePath(locale)}
              className="lp-focus"
              style={{ color: "var(--lp-text-muted)", textDecoration: "none" }}
            >
              {copy.nav.home}
            </Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "var(--lp-orange)" }}>{page.title}</span>
          </nav>

          <div className="lp-eyebrow" style={{ marginBottom: "0.5rem" }}>
            Statutory Public Governance
          </div>
          <h1
            id="info-page-heading"
            className="lp-serif"
            style={{
              fontSize: "clamp(2rem, 3.6vw, 3rem)",
              lineHeight: 1.15,
              color: "var(--lp-text)",
              margin: "0 0 0.85rem",
            }}
          >
            {page.title}
          </h1>
          <p
            style={{
              fontSize: "1.0625rem",
              lineHeight: 1.65,
              color: "var(--lp-text-secondary)",
              margin: 0,
              maxWidth: "46rem",
            }}
          >
            {page.intro}
          </p>
        </div>
      </section>

      <section className="lp-subpage-section" aria-label={page.title}>
        <div className="lp-container" style={{ maxWidth: "56rem" }}>
          <InfoSections page={page} />
        </div>
      </section>
    </LpSubpageShell>
  );
}
