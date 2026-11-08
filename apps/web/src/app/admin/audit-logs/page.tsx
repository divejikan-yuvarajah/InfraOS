import type { Metadata } from "next";

import { AdminAuditLogsPageClient } from "@/components/admin/admin-audit-logs-page-client";

export const metadata: Metadata = {
  title: "Governance Audit Ledger · INFRAOS",
  robots: { index: false, follow: false },
};

export default function AdminAuditLogsPage() {
  return <AdminAuditLogsPageClient />;
}

