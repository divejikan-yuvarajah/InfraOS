import type { Metadata } from "next";

import { AboutAiPageClient } from "@/components/ai-admin/about-ai-page-client";

export const metadata: Metadata = {
  title: "How AI is used · INFRAOS",
  description: "Transparency summary of AI features, external data handling, retention periods, and strict human-control boundaries.",
};

export default function AboutAiPage() {
  return <AboutAiPageClient />;
}

