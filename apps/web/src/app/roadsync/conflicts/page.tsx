import type { Metadata } from "next";

import { ConflictInbox } from "@/components/roadsync/conflict-inbox";

export const metadata: Metadata = {
  title: "Conflicts · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ConflictsPage() {
  return <ConflictInbox />;
}
