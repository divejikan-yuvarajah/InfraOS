import type { Metadata } from "next";

import { ResolutionArchive } from "@/components/roadsync/resolution-archive";

export const metadata: Metadata = {
  title: "History · INFRAOS",
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return <ResolutionArchive />;
}
