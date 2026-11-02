import type { Metadata } from "next";

import { CoordinationComposer } from "@/components/roadsync/coordination-composer";

export const metadata: Metadata = {
  title: "Propose a change · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function NewCoordinationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CoordinationComposer conflictId={id} />;
}
