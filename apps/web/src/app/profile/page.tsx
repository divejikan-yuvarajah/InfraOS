import type { Metadata } from "next";

import { ProfilePageClient } from "@/components/profile/profile-page-client";

export const metadata: Metadata = {
  title: "Profile · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}
