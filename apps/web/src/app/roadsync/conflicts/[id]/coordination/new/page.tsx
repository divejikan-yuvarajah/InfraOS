import type { Metadata } from "next";

import { PrefilledComposer } from "@/components/roadsync/prefilled";

export const metadata: Metadata = {
  title: "Propose a change · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function NewCoordinationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrefilledComposer conflictId={id} />;
}
