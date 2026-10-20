import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("ta", "privacy");

export default function PrivacyPageTa() {
  return <PublicInformationPage locale="ta" slug="privacy" />;
}
