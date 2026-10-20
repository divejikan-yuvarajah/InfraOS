import { PublicHome, publicPageMetadata } from "@/components/landing/public-home";

export const metadata = publicPageMetadata("en");

export default function HomePage() {
  return <PublicHome locale="en" />;
}
