import Link from "next/link";

import type { NextStepAnchor } from "@/lib/landing/faq-items";
import { NEXT_STEPS_SECTION_ANCHOR } from "@/lib/landing/faq-items";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import {
  FEATURES_SECTION_ANCHOR,
  HOW_IT_WORKS_SECTION_ANCHOR,
} from "@/lib/landing/navigation";
import { PREVIEW_SECTION_ANCHOR } from "@/lib/landing/preview-data";

const STEP_HREF: Record<NextStepAnchor, string> = {
  features: `#${FEATURES_SECTION_ANCHOR}`,
  lifecycle: `#${HOW_IT_WORKS_SECTION_ANCHOR}`,
  preview: `#${PREVIEW_SECTION_ANCHOR}`,
};

export function LandingNextStepsSection({ copy }: { copy: PublicLandingCopy }) {
  const next = copy.nextSteps;
  const primaryHref = STEP_HREF[next.primaryAnchor];
  const secondaryHref = STEP_HREF[next.secondaryAnchor];

  return (
    <section
      id={NEXT_STEPS_SECTION_ANCHOR}
      aria-labelledby="next-steps-heading"
      className="scroll-mt-28 border-b border-border bg-surface"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page py-12 md:py-16">
        <header className="mx-auto max-w-prose space-y-3 text-center md:text-start">
          <p className="type-label text-link">{next.eyebrow}</p>
          <h2 id="next-steps-heading" className="type-section-title text-balance text-text-primary">
            {next.title}
          </h2>
          <p className="type-body text-text-secondary">{next.intro}</p>
        </header>

        <div className="mx-auto mt-8 flex max-w-prose flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={primaryHref}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground type-body-small hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {next.primaryLabel}
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-4 py-2 type-body-small text-text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {next.secondaryLabel}
          </Link>
        </div>

        <p className="type-caption mx-auto mt-6 max-w-prose text-center text-text-muted md:text-start">
          {next.staffNote}
        </p>
      </div>
    </section>
  );
}
