import type { Metadata } from "next";

import { HowItWorksPage } from "@/components/landing/lp/how-it-works-page";
import { publicInformationMetadata } from "@/components/landing/public-information-page";
import type { PublicLocale } from "@/lib/landing/locales";

export function publicHowItWorksMetadata(locale: PublicLocale): Metadata {
  return publicInformationMetadata(locale, "how-it-works");
}

export function PublicHowItWorksPage({ locale }: { locale: PublicLocale }) {
  return <HowItWorksPage locale={locale} />;
}
