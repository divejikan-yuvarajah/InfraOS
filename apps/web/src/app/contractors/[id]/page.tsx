import type { Metadata } from "next";
import { Suspense } from "react";

import { ContractorProfileClient } from "@/components/contractors/contractor-profile-client";

export const metadata: Metadata = {
  title: "Contractor · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ContractorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ContractorProfileClient id={id} />
    </Suspense>
  );
}
