import type { Metadata } from "next";
import { Suspense } from "react";

import { InspectionWorkspace } from "@/components/inspections/inspection-workspace";

export const metadata: Metadata = {
  title: "Inspection · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <InspectionWorkspace id={id} />
    </Suspense>
  );
}
