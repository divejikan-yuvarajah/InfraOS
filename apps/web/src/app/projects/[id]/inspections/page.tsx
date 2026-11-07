import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectInspectionsTab } from "@/components/inspections/inspection-integrations";

export const metadata: Metadata = {
  title: "Project inspections · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ProjectInspectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ProjectInspectionsTab id={id} />
    </Suspense>
  );
}
