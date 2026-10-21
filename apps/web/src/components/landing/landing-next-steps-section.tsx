import Link from "next/link";

import type { NextStepAnchor } from "@/lib/landing/faq-items";
import { NEXT_STEPS_SECTION_ANCHOR } from "@/lib/landing/faq-items";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import {
  FEATURES_SECTION_ANCHOR,
  HOW_IT_WORKS_SECTION_ANCHOR,
  SOLUTION_SECTION_ANCHOR,
} from "@/lib/landing/navigation";
import { PREVIEW_SECTION_ANCHOR } from "@/lib/landing/preview-data";

const STEP_HREF: Record<NextStepAnchor, string> = {
  features: `#${FEATURES_SECTION_ANCHOR}`,
  lifecycle: `#${HOW_IT_WORKS_SECTION_ANCHOR}`,
  preview: `#${PREVIEW_SECTION_ANCHOR}`,
  solution: `#${SOLUTION_SECTION_ANCHOR}`,
};

export function LandingNextStepsSection({ copy }: { copy: PublicLandingCopy }) {
  const next = copy.nextSteps;
  const primaryHref = STEP_HREF[next.primaryAnchor];
  const secondaryHref = STEP_HREF[next.secondaryAnchor];

  return (
    <section
      id={NEXT_STEPS_SECTION_ANCHOR}
      aria-labelledby="next-steps-heading"
      className="cf-next-steps scroll-mt-28"
      tabIndex={-1}
    >
      <svg
        className="cf-next-steps__route"
        viewBox="0 0 800 200"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0 120 Q 200 80, 400 100 T 800 90"
          fill="none"
          stroke="#FF5B00"
          strokeWidth="3"
          strokeDasharray="12 8"
          opacity="0.6"
        />
        <path
          d="M0 140 H 800"
          fill="none"
          stroke="#279541"
          strokeWidth="2"
          opacity="0.35"
        />
      </svg>
      <div className="container-dashboard gutter-page cf-next-steps__inner">
        <header className="max-w-prose space-y-3">
          <p className="cf-transparency-section__eyebrow cf-gis-section__eyebrow">{next.eyebrow}</p>
          <h2 id="next-steps-heading" className="cf-next-steps__title text-balance">
            {next.title}
          </h2>
          <p className="cf-next-steps__intro">{next.intro}</p>
        </header>

        <div className="cf-next-steps__actions">
          <Link href={primaryHref} className="cf-next-steps__primary">
            {next.primaryLabel}
          </Link>
          <Link href={secondaryHref} className="cf-next-steps__secondary">
            {next.secondaryLabel}
          </Link>
        </div>

        <p className="cf-next-steps__note">{next.staffNote}</p>
      </div>
    </section>
  );
}
