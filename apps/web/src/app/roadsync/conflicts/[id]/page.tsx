import type { Metadata } from "next";
import { Suspense } from "react";

import { ConflictDossier } from "@/components/roadsync/conflict-dossier";

export const metadata: Metadata = {
  title: "Conflict · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function ConflictDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <ConflictDossier id={id} />
    </Suspense>
  );
}
