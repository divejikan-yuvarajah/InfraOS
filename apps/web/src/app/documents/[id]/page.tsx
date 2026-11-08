import type { Metadata } from "next";
import { Suspense } from "react";

import { DocumentDetail } from "@/components/documents/document-detail";

export const metadata: Metadata = { title: "Document · INFRAOS", robots: { index: false, follow: false } };

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <DocumentDetail id={id} />
    </Suspense>
  );
}
