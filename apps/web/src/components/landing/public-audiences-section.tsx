import Link from "next/link";
import { ArrowUpRight, Building2, ClipboardCheck, GraduationCap, Users } from "lucide-react";

import type { AudienceActionAnchor, AudienceGroupId } from "@/lib/landing/audience-groups";
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

const PATH_ICONS: Record<AudienceGroupId, typeof Users> = {
  citizens: Users,
  "agency-teams": Building2,
  "field-teams": ClipboardCheck,
  visitors: GraduationCap,
};

export function PublicAudiencesSection({ copy }: { copy: PublicLandingCopy }) {
  const audiences = copy.audiences;

  return (
    <section
      id={AUDIENCES_SECTION_ANCHOR}
      aria-labelledby="audiences-heading"
      className="cf-audiences-section scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page cf-audiences-section__inner">
        <header className="cf-audiences-section__header">
          <p className="cf-gis-section__eyebrow">{audiences.eyebrow}</p>
          <h2 id="audiences-heading" className="cf-gis-section__title text-balance">
            {audiences.title}
          </h2>
          <p className="cf-gis-section__intro">{audiences.intro}</p>
        </header>

        <ul className="cf-audiences-pathways list-none p-0 m-0">
          {AUDIENCE_GROUP_IDS.map((groupId) => {
            const group = audiences.groups.find((g) => g.id === groupId);
            if (!group) return null;
            const Icon = PATH_ICONS[groupId];
            const actionHref = group.actionAnchor ? ACTION_HREF[group.actionAnchor] : null;

            return (
              <li key={groupId}>
                <article className={`cf-audience-path cf-audience-path--${groupId}`}>
                  <div className="cf-audience-path__icon" aria-hidden>
                    <Icon strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="cf-audience-path__title">{group.title}</h3>
                    <p className="cf-audience-path__body">{group.body}</p>
                    {actionHref && group.actionLabel ? (
                      <Link href={actionHref} className="cf-audience-path__link">
                        {group.actionLabel}
                        <ArrowUpRight className="size-3.5" aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>

        <aside className="cf-audiences-aside" aria-labelledby="audiences-benefits-title">
          <h3 id="audiences-benefits-title" className="cf-audiences-aside__title">
            {audiences.benefitsTitle}
          </h3>
          <ul className="cf-audiences-aside__list">
            {audiences.benefits.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ul>
          <p className="cf-audiences-staff-note mt-3">{audiences.benefitsDisclaimer}</p>
        </aside>

        <p className="cf-audiences-staff-note">{audiences.staffAccessNote}</p>
      </div>
    </section>
  );
}
