import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("en", "privacy");

export default function PrivacyPageEn() {
  return <PublicInformationPage locale="en" slug="privacy" />;
}
