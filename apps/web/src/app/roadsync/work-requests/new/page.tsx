import type { Metadata } from "next";

import { WorkRequestNewClient } from "@/components/roadsync/work-request-new-client";

export const metadata: Metadata = {
  title: "Create Work Request · INFRAOS",
  robots: { index: false, follow: false },
};

export default function NewWorkRequestPage() {
  return <WorkRequestNewClient />;
}
