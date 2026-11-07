import type { Metadata } from "next";
import { Suspense } from "react";

import { PaymentQueue } from "@/components/finance/payment-queue";

export const metadata: Metadata = {
  title: "Payment queue · INFRAOS",
  robots: { index: false, follow: false },
};

export default function PaymentQueuePage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <PaymentQueue />
    </Suspense>
  );
}
