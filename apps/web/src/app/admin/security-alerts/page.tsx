import type { Metadata } from "next";

import { AdminSecurityAlertsPageClient } from "@/components/admin/admin-security-alerts-page-client";

export const metadata: Metadata = {
  title: "Security Alert Center & Staff Provisioning · INFRAOS",
  robots: { index: false, follow: false },
};

export default function AdminSecurityAlertsPage() {
  return <AdminSecurityAlertsPageClient />;
}

