import type { Metadata } from "next";
import { Suspense } from "react";

import { ConversionsQueue } from "@/components/assets/conversions-queue";

export const metadata: Metadata = { title: "Conversions · INFRAOS", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ConversionsQueue />
    </Suspense>
  );
}
