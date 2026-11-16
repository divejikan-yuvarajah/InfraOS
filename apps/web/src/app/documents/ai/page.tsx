import type { Metadata } from "next";
import { Suspense } from "react";

import { AiWorkspace } from "@/components/documents/ai/workspace/ai-workspace";
import { ContentSkeleton } from "@/components/feedback/content-skeleton";

export const metadata: Metadata = { title: "AI Documents · INFRAOS", robots: { index: false, follow: false } };

export default function AiDocumentsPage() {
  return (
    <Suspense fallback={<div className="p-6"><ContentSkeleton variant="detail" label="Loading AI Documents" /></div>}>
      <AiWorkspace />
    </Suspense>
  );
}
