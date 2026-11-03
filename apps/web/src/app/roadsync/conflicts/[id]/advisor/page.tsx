import type { Metadata } from "next";
import { Suspense } from "react";

import { AdvisorPage } from "@/components/roadsync/advisor-tab";

export const metadata: Metadata = {
  title: "Advisor · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ConflictAdvisorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <AdvisorPage id={id} />
    </Suspense>
  );
}
