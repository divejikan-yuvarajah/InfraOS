import { PublicFaqPage, publicFaqMetadata } from "@/components/landing/public-faq-page";

export const metadata = publicFaqMetadata("en");

export default function FaqPageEn() {
  return <PublicFaqPage locale="en" />;
}
