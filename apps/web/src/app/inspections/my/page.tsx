import type { Metadata } from "next";
import { Suspense } from "react";

import { MyWorkClient } from "@/components/inspections/my-work-client";

export const metadata: Metadata = {
  title: "My inspections · INFRAOS",
  robots: { index: false, follow: false },
};

export default function MyInspectionsPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <MyWorkClient />
    </Suspense>
  );
}
