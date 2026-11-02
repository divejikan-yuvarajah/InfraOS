import type { Metadata } from "next";
import { Suspense } from "react";

import { NegotiationRoom } from "@/components/roadsync/negotiation-room";

export const metadata: Metadata = {
  title: "Negotiation Room · INFRAOS",
  robots: { index: false, follow: false },
};

export default async function NegotiationRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <NegotiationRoom id={id} />
    </Suspense>
  );
}
