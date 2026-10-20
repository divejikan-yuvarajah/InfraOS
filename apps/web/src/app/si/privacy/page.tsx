import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("si", "privacy");

export default function PrivacyPageSi() {
  return <PublicInformationPage locale="si" slug="privacy" />;
}
