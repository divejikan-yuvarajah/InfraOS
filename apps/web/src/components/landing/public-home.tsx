import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/lp/landing-page";
import { getLpCopy } from "@/lib/landing/lp-copy";
import { PUBLIC_LOCALES, publicHomePath, type PublicLocale } from "@/lib/landing/locales";

const OG_LOCALE: Record<PublicLocale, string> = { en: "en_US", si: "si_LK", ta: "ta_LK" };

export function publicPageMetadata(locale: PublicLocale): Metadata {
  const { meta } = getLpCopy(locale);
  const image = {
    url: "/landing/lp/hero-coordination.jpg",
    width: 1376,
    height: 768,
    alt: getLpCopy(locale).hero.imageAlt,
  };
  return {
    title: { absolute: meta.title },
    description: meta.description,
    robots: { index: false, follow: false },
    alternates: {
      canonical: publicHomePath(locale),
      languages: {
        en: publicHomePath("en"),
        si: publicHomePath("si"),
        ta: publicHomePath("ta"),
        "x-default": publicHomePath("en"),
      },
    },
    openGraph: {
      type: "website",
      siteName: "INFRAOS",
      title: meta.title,
      description: meta.description,
      locale: OG_LOCALE[locale],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [image.url],
    },
  };
}

export function PublicHome({ locale }: { locale: PublicLocale }) {
  return <LandingPage locale={locale} />;
}

export { PUBLIC_LOCALES };
