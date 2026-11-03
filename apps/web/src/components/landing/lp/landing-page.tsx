import { MAIN_CONTENT_ID } from "@/lib/accessibility/document-landmarks";
import { getLpCopy } from "@/lib/landing/lp-copy";
import { getLpLinks } from "@/lib/landing/lp-data";
import type { PublicLocale } from "@/lib/landing/locales";

import "@/styles/lp.css";

import { AudiencePathways } from "./audience-pathways";
import { CivicFooter } from "./civic-footer";
import { CoreCapabilitiesSection } from "./core-capabilities-section";
import { DispatchConsolePreview } from "./dispatch-console-preview";
import { HeroSection } from "./hero-section";
import { IncidentSequenceSimulation } from "./incident-sequence-simulation";
import { LifecycleStepper } from "./lifecycle-stepper";
import { lpFontClass } from "./lp-fonts";
import { LpHeader } from "./lp-header";
import { ProblemSolutionSection } from "./problem-solution-section";
import { TransparencyPanel } from "./transparency-panel";

/** Public landing page for one locale. All tokens are scoped to `.lp-root`. */
export function LandingPage({ locale }: { locale: PublicLocale }) {
  const copy = getLpCopy(locale);
  const links = getLpLinks(locale);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "INFRAOS — National Infrastructure Intelligence & Coordination Platform",
    inLanguage: locale,
    description: copy.hero.lede,
    publisher: {
      "@type": "Organization",
      name: "INFRAOS University GovTech Research Prototype",
      description: copy.transparency.lede,
    },
  };

  return (
    <div lang={locale} className={`${lpFontClass} lp-root flex flex-1 flex-col`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LpHeader copy={copy.nav} links={links} locale={locale} />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
        <HeroSection copy={copy.hero} />
        <ProblemSolutionSection copy={copy.problem} />
        <LifecycleStepper copy={copy.lifecycle} />
        <IncidentSequenceSimulation copy={copy.incident} />
        <CoreCapabilitiesSection copy={copy.capabilities} links={links} />
        <DispatchConsolePreview copy={copy.dispatch} />
        <AudiencePathways copy={copy.audiences} links={links} />
        <TransparencyPanel copy={copy.transparency} />
      </main>
      <CivicFooter copy={copy.footer} nav={copy.nav} stages={copy.lifecycle.stages} links={links} locale={locale} />
    </div>
  );
}

