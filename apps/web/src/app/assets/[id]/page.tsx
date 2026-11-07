import type { Metadata } from "next";
import { Suspense } from "react";

import { AssetPassport } from "@/components/assets/asset-passport";

export const metadata: Metadata = { title: "Asset passport · INFRAOS", robots: { index: false, follow: false } };

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <AssetPassport id={id} />
    </Suspense>
  );
}
