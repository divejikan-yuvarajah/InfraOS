import {
  PublicHowItWorksPage,
  publicHowItWorksMetadata,
} from "@/components/landing/public-how-it-works-page";

export const metadata = publicHowItWorksMetadata("ta");

export default function HowItWorksPageTa() {
  return <PublicHowItWorksPage locale="ta" />;
}
