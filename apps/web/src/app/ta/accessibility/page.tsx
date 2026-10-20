import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("ta", "accessibility");

export default function AccessibilityPageTa() {
  return <PublicInformationPage locale="ta" slug="accessibility" />;
}
