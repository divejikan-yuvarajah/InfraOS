import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentSkeleton } from "@/components/feedback/content-skeleton";
import { ConflictDossier } from "@/components/roadsync/conflict-dossier";

export const metadata: Metadata = {
  title: "Conflict · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ConflictDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-6"><ContentSkeleton variant="detail" label="Loading Conflict Dossier" /></div>}>
      <ConflictDossier id={id} />
    </Suspense>
  );
}
