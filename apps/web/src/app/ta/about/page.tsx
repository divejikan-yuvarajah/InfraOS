import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("ta", "about");

export default function AboutPageTa() {
  return <PublicInformationPage locale="ta" slug="about" />;
}
