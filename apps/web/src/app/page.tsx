import type { Metadata } from "next";

import { UiFoundationFixtures } from "@/components/dev/ui-foundation-fixtures";
import { LandingHero } from "@/components/landing/landing-hero";
import { PublicSiteHeader } from "@/components/landing/public-site-header";
import { MAIN_CONTENT_ID } from "@/lib/accessibility/document-landmarks";

export const metadata: Metadata = {
  title: "INFRAOS | National Infrastructure Intelligence & Coordination",
  description:
    "INFRAOS is a platform concept for coordinating infrastructure projects, schedules, agencies, and project progress through a shared workflow.",
};

export default function HomePage() {
  return (
    <>
      <PublicSiteHeader />
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col outline-none scroll-mt-16"
      >
        <LandingHero />
        {process.env.NODE_ENV === "development" ? <UiFoundationFixtures /> : null}
      </main>
    </>
  );
}
