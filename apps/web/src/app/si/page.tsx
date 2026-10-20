import { PublicHome, publicPageMetadata } from "@/components/landing/public-home";

export const metadata = publicPageMetadata("si");

export default function SinhalaHomePage() {
  return <PublicHome locale="si" />;
}
