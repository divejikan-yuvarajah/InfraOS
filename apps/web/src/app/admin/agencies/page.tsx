import type { Metadata } from "next";

import { AdminAgenciesPageClient } from "@/components/admin/admin-agencies-page-client";

export const metadata: Metadata = {
  title: "Agencies · INFRAOS",
  robots: { index: false, follow: false },
};

export default function AdminAgenciesPage() {
  return <AdminAgenciesPageClient />;
}
