import type { Metadata } from "next";

import { ReportsClient } from "@/components/reports/reports-client";

export const metadata: Metadata = {
  title: "Reports & KPIs · INFRAOS",
  robots: { index: false, follow: false },
};

export default function ReportsPage() {
  return <ReportsClient />;
}
