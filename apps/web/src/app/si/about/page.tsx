import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("si", "about");

export default function AboutPageSi() {
  return <PublicInformationPage locale="si" slug="about" />;
}
