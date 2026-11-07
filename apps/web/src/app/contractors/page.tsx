import type { Metadata } from "next";
import { Suspense } from "react";

import { ContractorsPageClient } from "@/components/contractors/contractors-page-client";

export const metadata: Metadata = {
  title: "Contractors · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ContractorsPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ContractorsPageClient />
    </Suspense>
  );
}
