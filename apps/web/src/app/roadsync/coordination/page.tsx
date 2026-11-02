import type { Metadata } from "next";

import { CoordinationHub } from "@/components/roadsync/coordination-hub";

export const metadata: Metadata = {
  title: "Coordination · INFRAOS",
  robots: { index: false, follow: false },
};

export default function CoordinationPage() {
  return <CoordinationHub />;
}
