import { PublicHome, publicPageMetadata } from "@/components/landing/public-home";

export const metadata = publicPageMetadata("ta");

export default function TamilHomePage() {
  return <PublicHome locale="ta" />;
}
