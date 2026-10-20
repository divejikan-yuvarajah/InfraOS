import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("si", "accessibility");

export default function AccessibilityPageSi() {
  return <PublicInformationPage locale="si" slug="accessibility" />;
}
