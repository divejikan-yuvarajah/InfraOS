import {
  PublicHowItWorksPage,
  publicHowItWorksMetadata,
} from "@/components/landing/public-how-it-works-page";

export const metadata = publicHowItWorksMetadata("si");

export default function HowItWorksPageSi() {
  return <PublicHowItWorksPage locale="si" />;
}
