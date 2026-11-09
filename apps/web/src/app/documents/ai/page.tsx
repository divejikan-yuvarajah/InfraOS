import type { Metadata } from "next";
import { Suspense } from "react";

import { AiWorkspace } from "@/components/documents/ai/workspace/ai-workspace";

export const metadata: Metadata = { title: "AI Documents · INFRAOS", robots: { index: false, follow: false } };

export default function AiDocumentsPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <AiWorkspace />
    </Suspense>
  );
}
