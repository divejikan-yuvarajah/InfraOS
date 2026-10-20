import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("ta", "contact");

export default function ContactPageTa() {
  return <PublicInformationPage locale="ta" slug="contact" />;
}
