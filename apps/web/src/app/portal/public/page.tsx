import type { Metadata } from "next";

import { PublicPortalClient } from "@/components/portal/public-portal-client";

export const metadata: Metadata = {
  title: "Citizen Infrastructure Transparency Portal · INFRAOS",
  description:
    "Real-time public visibility into national road works, multi-utility trenching schedules, public capital expenditure, and commuter disruption advisories.",
};

export default function PublicTransparencyPortalPage() {
  return <PublicPortalClient />;
}

