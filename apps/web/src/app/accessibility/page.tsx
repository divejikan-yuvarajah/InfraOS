import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("en", "accessibility");

export default function AccessibilityPageEn() {
  return <PublicInformationPage locale="en" slug="accessibility" />;
}
