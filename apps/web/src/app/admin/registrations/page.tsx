import type { Metadata } from "next";

import { AdminRegistrationsPageClient } from "@/components/admin/admin-registrations-page-client";

export const metadata: Metadata = {
  title: "Registration Requests · INFRAOS",
  robots: { index: false, follow: false },
};

export default function AdminRegistrationsPage() {
  return <AdminRegistrationsPageClient />;
}

