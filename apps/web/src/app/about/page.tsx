import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("en", "about");

export default function AboutPageEn() {
  return <PublicInformationPage locale="en" slug="about" />;
}
