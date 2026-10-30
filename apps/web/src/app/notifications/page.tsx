import type { Metadata } from "next";

import { ProjectNotices } from "@/components/projects/project-notices";

export const metadata: Metadata = {
  title: "Notices · INFRAOS",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return <ProjectNotices />;
}
