import type { Metadata } from "next";

import { InframapWorkspace } from "@/components/inframap/inframap-workspace";

export const metadata: Metadata = {
  title: "InfraMap · INFRAOS",
  robots: { index: false, follow: false },
};

export default function InframapPage() {
  return <InframapWorkspace />;
}
