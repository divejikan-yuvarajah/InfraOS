import type { Metadata } from "next";
import { Suspense } from "react";

import { ContractorFormPageClient } from "@/components/contractors/contractor-form-page-client";

export const metadata: Metadata = {
  title: "Register contractor · INFRAOS",
  robots: { index: false, follow: false },
};

export default function RegisterContractorPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ContractorFormPageClient />
    </Suspense>
  );
}
