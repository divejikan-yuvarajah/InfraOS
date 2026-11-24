import type { Metadata } from "next";

import { CopilotPageClient } from "@/components/copilot/copilot-page-client";

export const metadata: Metadata = {
  title: "Copilot · INFRAOS",
  description: "Ask read-only questions about the projects, risks and records your role can see.",
};

export default function CopilotPage() {
  return <CopilotPageClient />;
}
