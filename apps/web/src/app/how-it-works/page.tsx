import {
  PublicHowItWorksPage,
  publicHowItWorksMetadata,
} from "@/components/landing/public-how-it-works-page";

export const metadata = publicHowItWorksMetadata("en");

export default function HowItWorksPageEn() {
  return <PublicHowItWorksPage locale="en" />;
}
