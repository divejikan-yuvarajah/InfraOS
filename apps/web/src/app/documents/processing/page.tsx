import type { Metadata } from "next";
import { Suspense } from "react";

import { ProcessingCenter } from "@/components/documents/ai/processing-center";

export const metadata: Metadata = { title: "AI Processing · INFRAOS", robots: { index: false, follow: false } };

export default function ProcessingPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ProcessingCenter />
    </Suspense>
  );
}
