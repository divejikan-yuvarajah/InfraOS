import type { Metadata } from "next";

import { ProfilePageClient } from "@/components/profile/profile-page-client";

export const metadata: Metadata = {
  title: "Profile & Workspace Settings · INFRAOS",
  robots: { index: false, follow: false },
};

export default function SettingsProfilePage() {
  return <ProfilePageClient />;
}

