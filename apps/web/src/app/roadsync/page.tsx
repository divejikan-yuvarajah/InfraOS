import type { Metadata } from "next";
import { Suspense } from "react";

import { CommandCenter } from "@/components/roadsync/command-center";

export const metadata: Metadata = {
  title: "RoadSync Dashboard · INFRAOS",
  robots: { index: false, follow: false },
};

export default function RoadsyncDashboardPage() {
  return (
    <Suspense fallback={<p role="status">Loading</p>}>
      <CommandCenter />
    </Suspense>
  );
}
