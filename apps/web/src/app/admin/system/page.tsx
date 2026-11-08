import type { Metadata } from "next";

import { AdminSystemPageClient } from "@/components/admin/admin-system-page-client";

export const metadata: Metadata = {
  title: "Platform Configuration & System Integrity · INFRAOS",
  robots: { index: false, follow: false },
};

export default function AdminSystemPage() {
  return <AdminSystemPageClient />;
}

