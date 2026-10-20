import {
  PublicInformationPage,
  publicInformationMetadata,
} from "@/components/landing/public-information-page";

export const metadata = publicInformationMetadata("si", "contact");

export default function ContactPageSi() {
  return <PublicInformationPage locale="si" slug="contact" />;
}
