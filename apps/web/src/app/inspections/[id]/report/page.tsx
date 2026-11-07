import type { Metadata } from "next";
import { Suspense } from "react";

import { ReportEditor } from "@/components/inspections/report-editor";

export const metadata: Metadata = {
  title: "Inspection report · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function InspectionReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ReportEditor id={id} />
    </Suspense>
  );
}
