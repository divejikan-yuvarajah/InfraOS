import { PublicFaqPage, publicFaqMetadata } from "@/components/landing/public-faq-page";

export const metadata = publicFaqMetadata("si");

export default function FaqPageSi() {
  return <PublicFaqPage locale="si" />;
}
