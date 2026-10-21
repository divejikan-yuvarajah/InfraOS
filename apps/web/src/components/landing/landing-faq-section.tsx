import Link from "next/link";
import { HelpCircle } from "lucide-react";

import {
  FAQ_ITEM_IDS,
  FAQ_SECTION_ANCHOR,
  FAQ_TOPIC_GROUPS,
  type FaqItemId,
} from "@/lib/landing/faq-items";
import { publicInfoPath, type PublicLocale } from "@/lib/landing/locales";
import type { PublicLandingCopy } from "@/lib/landing/messages";

function topicTitleForGroup(
  groupId: (typeof FAQ_TOPIC_GROUPS)[number]["id"],
  faq: PublicLandingCopy["faq"],
): string {
  switch (groupId) {
    case "demonstration":
      return faq.topicDemonstration;
    case "coordination":
      return faq.topicCoordination;
    case "public-access":
      return faq.topicPublicAccess;
    default:
      return faq.topicDemonstration;
  }
}

export function LandingFaqSection({
  copy,
  locale = "en",
  showFullPageLink = true,
}: {
  copy: PublicLandingCopy;
  locale?: PublicLocale;
  showFullPageLink?: boolean;
}) {
  const faq = copy.faq;
  const itemMap = new Map(faq.items.map((item) => [item.id as FaqItemId, item]));

  return (
    <section
      id={FAQ_SECTION_ANCHOR}
      aria-labelledby="faq-heading"
      className="cf-faq-section scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page cf-faq-section__inner">
        <header className="max-w-prose space-y-3">
          <p className="cf-gis-section__eyebrow">{faq.eyebrow}</p>
          <h2 id="faq-heading" className="cf-gis-section__title text-balance">
            {faq.title}
          </h2>
          <p className="cf-gis-section__intro">{faq.intro}</p>
        </header>

        {FAQ_TOPIC_GROUPS.map((group) => {
          const topicTitle = topicTitleForGroup(group.id, faq);
          return (
            <div key={group.id} className="cf-faq-topic">
              <h3 className="cf-faq-topic__title">{topicTitle}</h3>
              <ul className="cf-faq-list">
                {group.itemIds.map((itemId) => {
                  const item = itemMap.get(itemId);
                  if (!item) return null;
                  return (
                    <li key={itemId}>
                      <details className="cf-faq-item group">
                        <summary className="cf-faq-item__summary">
                          <span className="cf-faq-item__chevron" aria-hidden>
                            ▾
                          </span>
                          {item.question}
                        </summary>
                        <p className="cf-faq-item__answer">{item.answer}</p>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {showFullPageLink ? (
          <p className="cf-faq-full-page">
            <HelpCircle className="me-1 inline size-4 align-text-bottom text-[#64748b]" aria-hidden />
            {faq.fullPagePrompt}{" "}
            <Link href={publicInfoPath(locale, "faq")}>{faq.fullPageLink}</Link>
          </p>
        ) : null}

        <p className="sr-only">
          {FAQ_ITEM_IDS.length} questions available. Expand each item for the answer.
        </p>
      </div>
    </section>
  );
}
