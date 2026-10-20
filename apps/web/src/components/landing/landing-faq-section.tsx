import { FAQ_ITEM_IDS, FAQ_SECTION_ANCHOR } from "@/lib/landing/faq-items";
import type { PublicLandingCopy } from "@/lib/landing/messages";

export function LandingFaqSection({ copy }: { copy: PublicLandingCopy }) {
  const faq = copy.faq;

  return (
    <section
      id={FAQ_SECTION_ANCHOR}
      aria-labelledby="faq-heading"
      className="scroll-mt-28 border-b border-border bg-background"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page public-section-pad">
        <header className="mx-auto max-w-prose space-y-3">
          <p className="type-label text-link">{faq.eyebrow}</p>
          <h2 id="faq-heading" className="type-section-title text-balance text-text-primary">
            {faq.title}
          </h2>
          <p className="type-body text-text-secondary">{faq.intro}</p>
        </header>

        <div className="mx-auto mt-8 max-w-prose space-y-2">
          {FAQ_ITEM_IDS.map((itemId) => {
            const item = faq.items.find((entry) => entry.id === itemId);
            if (!item) return null;
            return (
              <details
                key={itemId}
                className="group rounded-lg border border-border bg-surface px-4 py-2 open:pb-4"
              >
                <summary className="type-body-small cursor-pointer list-none py-2 font-medium text-text-primary marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    {item.question}
                    <span
                      aria-hidden="true"
                      className="text-text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    >
                      ▾
                    </span>
                  </span>
                </summary>
                <p className="type-body-small border-t border-border pt-3 text-text-secondary">
                  {item.answer}
                </p>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
