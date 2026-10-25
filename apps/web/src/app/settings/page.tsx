import type { Metadata } from "next";

import { SettingsPageClient } from "@/components/profile/settings-page-client";

export const metadata: Metadata = {
  title: "Account settings · INFRAOS",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
