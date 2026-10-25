import type { Metadata } from "next";

import { AdminRolesPageClient } from "@/components/admin/admin-roles-page-client";

export const metadata: Metadata = {
  title: "Roles · INFRAOS",
  robots: { index: false, follow: false },
};

export default function AdminRolesPage() {
  return <AdminRolesPageClient />;
}
