import { ConnectedLifecyclePath } from "@/components/landing/connected-lifecycle-path";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import { HOW_IT_WORKS_SECTION_ANCHOR } from "@/lib/landing/navigation";

export function InfrastructureLifecycleSection({ copy }: { copy: PublicLandingCopy }) {
  const lifecycle = copy.lifecycle;

  return (
    <section
      id={HOW_IT_WORKS_SECTION_ANCHOR}
      aria-labelledby="lifecycle-heading"
      className="cf-lifecycle-section scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page cf-lifecycle-section__inner">
        <header className="cf-lifecycle-section__header">
          <p className="cf-lifecycle-section__eyebrow">{lifecycle.eyebrow}</p>
          <h2 id="lifecycle-heading" className="cf-lifecycle-section__title text-balance">
            {lifecycle.title}
          </h2>
          <p className="cf-lifecycle-section__intro">{lifecycle.intro}</p>
        </header>

        <ConnectedLifecyclePath copy={copy} labelledBy="lifecycle-heading" />

        <div className="cf-lifecycle-section__scenario">
          <p className="cf-lifecycle-section__scenario-title">{lifecycle.scenarioTitle}</p>
          <p className="cf-lifecycle-section__scenario-body">{lifecycle.scenarioBody}</p>
          <p className="cf-lifecycle-section__scenario-note">{lifecycle.approvalsNote}</p>
        </div>
      </div>
    </section>
  );
}
