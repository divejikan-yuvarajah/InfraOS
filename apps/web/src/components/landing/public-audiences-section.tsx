import Link from "next/link";

import type { AudienceActionAnchor } from "@/lib/landing/audience-groups";
import { AUDIENCE_GROUP_IDS } from "@/lib/landing/audience-groups";
import type { PublicLandingCopy } from "@/lib/landing/messages";
import {
  AUDIENCES_SECTION_ANCHOR,
  FEATURES_SECTION_ANCHOR,
  HOW_IT_WORKS_SECTION_ANCHOR,
  PROBLEM_SECTION_ANCHOR,
  SOLUTION_SECTION_ANCHOR,
} from "@/lib/landing/navigation";

const ACTION_HREF: Record<AudienceActionAnchor, string> = {
  problem: `#${PROBLEM_SECTION_ANCHOR}`,
  solution: `#${SOLUTION_SECTION_ANCHOR}`,
  features: `#${FEATURES_SECTION_ANCHOR}`,
  lifecycle: `#${HOW_IT_WORKS_SECTION_ANCHOR}`,
};

export function PublicAudiencesSection({ copy }: { copy: PublicLandingCopy }) {
  const audiences = copy.audiences;

  return (
    <section
      id={AUDIENCES_SECTION_ANCHOR}
      aria-labelledby="audiences-heading"
      className="scroll-mt-28 border-b border-border bg-background"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad">
        <header className="mx-auto max-w-prose space-y-3">
          <p className="type-label text-link">{audiences.eyebrow}</p>
          <h2 id="audiences-heading" className="type-section-title text-balance text-text-primary">
            {audiences.title}
          </h2>
          <p className="type-body text-text-secondary">{audiences.intro}</p>
        </header>

        <ul className="mt-10 divide-y divide-border border-y border-border">
          {AUDIENCE_GROUP_IDS.map((groupId) => {
            const group = audiences.groups.find((g) => g.id === groupId);
            if (!group) return null;
            const actionHref = group.actionAnchor
              ? ACTION_HREF[group.actionAnchor]
              : null;

            return (
              <li key={groupId} className="grid gap-3 py-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
                <h3 className="type-card-title text-text-primary">{group.title}</h3>
                <div className="min-w-0 space-y-3">
                  <p className="type-body max-w-prose text-text-secondary">{group.body}</p>
                  {actionHref && group.actionLabel ? (
                    <p>
                      <Link
                        href={actionHref}
                        className="type-body-small text-link underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {group.actionLabel}
                      </Link>
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 max-w-prose space-y-4">
          <h3 className="type-label text-text-primary">{audiences.benefitsTitle}</h3>
          <ul className="list-disc space-y-2 ps-5">
            {audiences.benefits.map((item) => (
              <li key={item.id} className="type-body-small text-text-secondary">
                {item.text}
              </li>
            ))}
          </ul>
          <p className="type-caption text-text-muted">{audiences.benefitsDisclaimer}</p>
        </div>

        <p className="type-body-small mx-auto mt-8 max-w-prose text-text-secondary">
          {audiences.staffAccessNote}
        </p>
      </div>
    </section>
  );
}
