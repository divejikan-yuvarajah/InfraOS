import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("en", "contact");

export default function ContactPageEn() {
  return <PublicInformationPage locale="en" slug="contact" />;
}
