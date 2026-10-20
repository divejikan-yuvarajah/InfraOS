import { LifecycleStepper } from "@/components/landing/lifecycle-stepper";
import { LandingSectionPhoto } from "@/components/landing/landing-section-photo";
import { lifecycleStagesForStepper } from "@/lib/landing/lifecycle-stepper-data";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { HOW_IT_WORKS_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function InfrastructureLifecycleSection({ copy }: { copy: PublicLandingCopy }) {
  const lifecycle = copy.lifecycle;
  const stages = lifecycleStagesForStepper(copy);

  return (
    <section
      id={HOW_IT_WORKS_SECTION_ANCHOR}
      aria-labelledby="lifecycle-heading"
      className="scroll-mt-28 border-b border-border bg-surface"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_min(100%,22rem)] lg:items-start lg:gap-12">
          <div className="min-w-0 space-y-8">
            <header className="max-w-prose space-y-3">
              <p className="type-label text-link">{lifecycle.eyebrow}</p>
              <h2
                id="lifecycle-heading"
                className="type-section-title text-balance text-text-primary"
              >
                {lifecycle.title}
              </h2>
              <p className="type-body text-text-secondary">{lifecycle.intro}</p>
            </header>

            <LifecycleStepper
              stages={stages}
              variant="vertical"
              labelledBy="lifecycle-heading"
            />

            <div className="max-w-prose space-y-3 rounded-xl border border-border bg-muted/40 p-4">
              <p className="type-label text-text-primary">{lifecycle.scenarioTitle}</p>
              <p className="type-body-small text-text-secondary">{lifecycle.scenarioBody}</p>
              <p className="type-caption text-text-muted">{lifecycle.approvalsNote}</p>
            </div>
          </div>

          <LandingSectionPhoto
            photoId="southernExpressway"
            alt={copy.photography.lifecycleExpresswayAlt}
            credit={copy.photography.lifecycleExpresswayCredit}
            aspectClassName="aspect-video"
            className="lg:sticky lg:top-28"
          />
        </div>
      </div>
    </section>
  );
}
