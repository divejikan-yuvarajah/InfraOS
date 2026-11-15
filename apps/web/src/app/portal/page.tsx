import type { Metadata } from "next";
import { PortalDirectoryClient } from "@/components/portal/portal-directory-client";

export const metadata: Metadata = {
  title: "Public Transparency Portal · INFRAOS",
  description: "Public infrastructure projects, Sri Lanka map, and citizen issue reporting.",
};

export default function PublicPortalPage() {
  return <PortalDirectoryClient locale="en" />;
}
