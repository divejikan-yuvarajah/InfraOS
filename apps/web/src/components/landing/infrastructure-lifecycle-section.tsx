import { LifecycleStepper } from "@/components/landing/lifecycle-stepper";
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
      className="public-lifecycle-route scroll-mt-28 border-b border-border"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad">
        <header className="max-w-prose space-y-3">
          <p className="type-label text-[#FEB600]">{lifecycle.eyebrow}</p>
          <h2
            id="lifecycle-heading"
            className="type-section-title text-balance text-white"
          >
            {lifecycle.title}
          </h2>
          <p className="type-body text-slate-300">{lifecycle.intro}</p>
        </header>

        <div className="mt-10 hidden md:block">
          <LifecycleStepper
            stages={stages}
            variant="horizontal"
            labelledBy="lifecycle-heading"
          />
        </div>
        <div className="mt-10 md:hidden">
          <LifecycleStepper
            stages={stages}
            variant="vertical"
            labelledBy="lifecycle-heading"
          />
        </div>

        <div className="mt-10 max-w-prose space-y-3 rounded-lg border border-white/15 bg-white/5 p-4">
          <p className="type-label text-white">{lifecycle.scenarioTitle}</p>
          <p className="type-body-small text-slate-300">{lifecycle.scenarioBody}</p>
          <p className="type-caption text-slate-400">{lifecycle.approvalsNote}</p>
        </div>
      </div>
    </section>
  );
}
