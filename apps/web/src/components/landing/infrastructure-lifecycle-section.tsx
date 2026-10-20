import { LandingSectionPhoto } from "@/components/landing/landing-section-photo";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { LIFECYCLE_STAGE_IDS } from "@/lib/landing/lifecycle-stages";
import { HOW_IT_WORKS_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function InfrastructureLifecycleSection({ copy }: { copy: PublicLandingCopy }) {
  const lifecycle = copy.lifecycle;

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

            <ol className="grid list-none gap-4 p-0 md:grid-cols-2 md:gap-x-6 md:gap-y-5">
              {LIFECYCLE_STAGE_IDS.map((stageId, index) => {
                const stage = lifecycle.stages.find((s) => s.id === stageId);
                if (!stage) return null;
                return (
                  <li
                    key={stageId}
                    className="public-motion-interactive min-w-0 rounded-lg border border-border bg-background p-4 shadow-elevation-sm hover:border-border/80 motion-reduce:transition-none"
                  >
                    <p className="type-caption text-text-muted">
                      {lifecycle.stageLabel} {index + 1}
                    </p>
                    <h3 className="type-card-title mt-1 text-text-primary">{stage.title}</h3>
                    <p className="type-body-small mt-2 text-text-secondary">{stage.body}</p>
                  </li>
                );
              })}
            </ol>

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
