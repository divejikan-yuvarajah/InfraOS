import type { Metadata } from "next";
import { Suspense } from "react";

import { ScenarioLab } from "@/components/roadsync/scenario-lab";

export const metadata: Metadata = {
  title: "Scenario Lab · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ScenarioLabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ScenarioLab id={id} />
    </Suspense>
  );
}
