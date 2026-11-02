import type { Metadata } from "next";

import { ApprovalsQueue } from "@/components/roadsync/approvals-queue";

export const metadata: Metadata = {
  title: "Approvals · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ApprovalsPage() {
  return <ApprovalsQueue />;
}
