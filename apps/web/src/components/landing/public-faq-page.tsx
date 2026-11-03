import type { Metadata } from "next";

import { FaqPage } from "@/components/landing/lp/faq-page";
import { publicInformationMetadata } from "@/components/landing/public-information-page";
import type { PublicLocale } from "@/lib/landing/locales";

export function publicFaqMetadata(locale: PublicLocale): Metadata {
  return publicInformationMetadata(locale, "faq");
}

export function PublicFaqPage({ locale }: { locale: PublicLocale }) {
  return <FaqPage locale={locale} />;
}
