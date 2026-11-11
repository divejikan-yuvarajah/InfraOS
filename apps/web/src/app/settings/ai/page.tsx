import type { Metadata } from "next";
import { Suspense } from "react";

import { AiSettingsPageClient } from "@/components/ai-admin/ai-settings-page-client";

export const metadata: Metadata = {
  title: "AI governance & operations · INFRAOS",
  robots: { index: false, follow: false },
};

export default function AiSettingsPage() {
  return (
    <Suspense fallback={null}>
      <AiSettingsPageClient />
    </Suspense>
  );
}

