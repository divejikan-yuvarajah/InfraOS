import { PublicFaqPage, publicFaqMetadata } from "@/components/landing/public-faq-page";

export const metadata = publicFaqMetadata("ta");

export default function FaqPageTa() {
  return <PublicFaqPage locale="ta" />;
}
