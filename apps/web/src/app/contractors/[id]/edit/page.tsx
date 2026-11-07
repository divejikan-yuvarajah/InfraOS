import type { Metadata } from "next";
import { Suspense } from "react";

import { ContractorFormPageClient } from "@/components/contractors/contractor-form-page-client";

export const metadata: Metadata = {
  title: "Edit contractor · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function EditContractorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ContractorFormPageClient id={id} />
    </Suspense>
  );
}
