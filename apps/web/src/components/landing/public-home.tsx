import type { Metadata } from "next";

import { UiFoundationFixtures } from "@/components/dev/ui-foundation-fixtures";
import { InfraosSolutionSection } from "@/components/landing/infraos-solution-section";
import { InfrastructureLifecycleSection } from "@/components/landing/infrastructure-lifecycle-section";
import { LandingFaqSection } from "@/components/landing/landing-faq-section";
import { LandingNextStepsSection } from "@/components/landing/landing-next-steps-section";
import { ProductGisPreviewSection } from "@/components/landing/product-gis-preview-section";
import { TrustInformationSection } from "@/components/landing/trust-information-section";
import { PublicAudiencesSection } from "@/components/landing/public-audiences-section";
import { PlatformFeaturesSection } from "@/components/landing/platform-features-section";
import { InfrastructureProblemSection } from "@/components/landing/infrastructure-problem-section";
import { LandingHero } from "@/components/landing/landing-hero";
import { PublicSiteFooter } from "@/components/landing/public-site-footer";
import { PublicSiteHeader } from "@/components/landing/public-site-header";
import { MAIN_CONTENT_ID } from "@/lib/accessibility/document-landmarks";
import {
  PUBLIC_LOCALES,
  publicHomePath,
  type PublicLocale,
} from "@/lib/landing/locales";
import { getPublicCopy } from "@/lib/landing/messages";

export function publicPageMetadata(locale: PublicLocale): Metadata {
  const copy = getPublicCopy(locale);
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: {
      canonical: publicHomePath(locale),
      languages: {
        en: publicHomePath("en"),
        si: publicHomePath("si"),
        ta: publicHomePath("ta"),
        "x-default": publicHomePath("en"),
      },
    },
  };
}

export function PublicHome({ locale }: { locale: PublicLocale }) {
  const copy = getPublicCopy(locale);

  return (
    <>
      <PublicSiteHeader locale={locale} copy={copy} />
      <main
        id={MAIN_CONTENT_ID}
        lang={locale}
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col scroll-mt-28 outline-none"
      >
        <LandingHero copy={copy} />
        <InfrastructureProblemSection copy={copy} />
        <InfraosSolutionSection copy={copy} />
        <PlatformFeaturesSection copy={copy} />
        <InfrastructureLifecycleSection copy={copy} />
        <PublicAudiencesSection copy={copy} />
        <ProductGisPreviewSection copy={copy} />
        <TrustInformationSection copy={copy} />
        <LandingFaqSection copy={copy} />
        <LandingNextStepsSection copy={copy} />
        {locale === "en" && process.env.NODE_ENV === "development" ? (
          <UiFoundationFixtures />
        ) : null}
      </main>
      <PublicSiteFooter copy={copy} />
    </>
  );
}

export { PUBLIC_LOCALES };
