import type { Metadata } from "next";
import Link from "next/link";

import { CoordinationSequenceDiagram } from "@/components/landing/coordination-sequence-diagram";
import { LifecycleStepper } from "@/components/landing/lifecycle-stepper";
import { PublicSiteFooter } from "@/components/landing/public-site-footer";
import { PublicSiteHeader } from "@/components/landing/public-site-header";
import { MAIN_CONTENT_ID } from "@/lib/accessibility/document-landmarks";
import { lifecycleStagesForStepper } from "@/lib/landing/lifecycle-stepper-data";
import { publicHomePath, type PublicLocale } from "@/lib/landing/locales";
import { getPublicCopy } from "@/lib/landing/messages";
import { publicInformationMetadata } from "@/components/landing/public-information-page";

export function publicHowItWorksMetadata(locale: PublicLocale): Metadata {
  return publicInformationMetadata(locale, "how-it-works");
}

export function PublicHowItWorksPage({ locale }: { locale: PublicLocale }) {
  const copy = getPublicCopy(locale);
  const page = copy.infoPages["how-it-works"];
  const stages = lifecycleStagesForStepper(copy);

  return (
    <div className="public-site public-visual-rescue flex min-h-full flex-1 flex-col">
      <PublicSiteHeader locale={locale} copy={copy} infoSlug="how-it-works" />
      <main
        id={MAIN_CONTENT_ID}
        lang={locale}
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col scroll-mt-28 outline-none"
      >
        <article className="container-dashboard gutter-page public-section-pad">
          <header className="mb-8 max-w-prose space-y-4">
            <p className="type-caption text-text-muted">
              <Link
                href={publicHomePath(locale)}
                className="text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {copy.nav.home}
              </Link>
            </p>
            <h1 className="type-page-title text-text-primary">{page.title}</h1>
            <p className="type-body text-text-secondary">{page.intro}</p>
          </header>

          <div className="sticky top-28 z-10 mb-10 rounded-lg border border-border bg-surface/95 p-4 backdrop-blur-sm">
            <p id="how-page-stepper-label" className="type-label mb-3 text-text-primary">
              {copy.lifecycle.eyebrow}
            </p>
            <LifecycleStepper
              stages={stages}
              variant="horizontal"
              labelledBy="how-page-stepper-label"
              scrollTargetPrefix="how-stage"
            />
          </div>

          <div className="space-y-10">
            {page.sections.map((section) => (
              <section key={section.id} aria-labelledby={`${section.id}-heading`} className="space-y-3">
                <h2 id={`${section.id}-heading`} className="type-heading-3 text-text-primary">
                  {section.heading}
                </h2>
                <p className="type-body max-w-prose text-text-secondary">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-12">
            <h2 className="type-heading-3 text-text-primary">{copy.lifecycle.scenarioTitle}</h2>
            <p className="type-body-small mt-2 max-w-prose text-text-secondary">
              {copy.lifecycle.scenarioBody}
            </p>
            <div className="mt-6">
              <CoordinationSequenceDiagram illustration={copy.illustration} solution={copy.solution} />
            </div>
          </div>

          <div className="mt-12">
            <LifecycleStepper
              stages={stages}
              variant="vertical"
              labelledBy="how-page-stepper-label"
              scrollTargetPrefix="how-stage"
            />
          </div>
        </article>
      </main>
      <PublicSiteFooter copy={copy} locale={locale} infoSlug="how-it-works" />
    </div>
  );
}
