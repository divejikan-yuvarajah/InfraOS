import type { Metadata } from "next";

import { AdminGovernancePageClient } from "@/components/admin/admin-governance-page-client";

export const metadata: Metadata = {
  title: "Platform Governance Command · INFRAOS",
  robots: { index: false, follow: false },
};

export default function AdminGovernancePage() {
  return <AdminGovernancePageClient />;
}

