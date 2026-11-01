import type { Metadata } from "next";

import { WorkRequestsListClient } from "@/components/roadsync/work-requests-list-client";

export const metadata: Metadata = {
  title: "Work Requests · INFRAOS",
  robots: { index: false, follow: false },
};

export default function WorkRequestsPage() {
  return <WorkRequestsListClient />;
}
