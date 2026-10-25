import type { Metadata } from "next";

import { AdminUsersPageClient } from "@/components/admin/admin-users-page-client";

export const metadata: Metadata = {
  title: "Staff directory · INFRAOS",
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return <AdminUsersPageClient />;
}
