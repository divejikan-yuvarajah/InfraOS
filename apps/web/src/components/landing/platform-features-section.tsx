import { ClipboardList, Map, Megaphone, Route, ShieldCheck, Layers } from "lucide-react";

import type { PublicLandingCopy } from "@/lib/landing/messages";
import { FEATURES_SECTION_ANCHOR } from "@/lib/landing/navigation";

const SPOTLIGHT_META: Record<
  string,
  { icon: typeof Route; accent: "trace" | "roadsync" }
> = {
  projecttrace: { icon: ClipboardList, accent: "trace" },
  roadsync: { icon: Route, accent: "roadsync" },
};

const PLANNED_ICONS: Record<string, typeof Map> = {
  inframap: Map,
  verification: ShieldCheck,
  "public-info": Megaphone,
};

export function PlatformFeaturesSection({ copy }: { copy: PublicLandingCopy }) {
  const { features } = copy;
  const spotlightIds = new Set(["projecttrace", "roadsync"]);
  const spotlight = features.items.filter((item) => spotlightIds.has(item.id));
  const roadmap = features.items.filter((item) => !spotlightIds.has(item.id));

  return (
    <section
      id={FEATURES_SECTION_ANCHOR}
      aria-labelledby="features-heading"
      className="cf-features-section scroll-mt-28"
      tabIndex={-1}
    >
      <div className="container-dashboard gutter-page cf-features-section__inner">
        <header className="cf-features-section__header">
          <p className="cf-features-section__eyebrow">{features.eyebrow}</p>
          <h2 id="features-heading" className="cf-features-section__title text-balance">
            {features.title}
          </h2>
          <p className="cf-features-section__intro">{features.intro}</p>
        </header>

        <div className="cf-features-spotlight">
          {spotlight.map((item) => {
            const meta = SPOTLIGHT_META[item.id];
            const Icon = meta?.icon ?? Layers;
            const statusLabel =
              item.status === "demonstration"
                ? features.statusDemonstration
                : features.statusPlanned;
            return (
              <article
                key={item.id}
                className={`cf-features-spotlight__panel cf-features-spotlight__panel--${meta?.accent ?? "trace"}`}
              >
                <div className="cf-features-spotlight__visual" aria-hidden>
                  <Icon className="cf-features-spotlight__glyph" strokeWidth={1.5} />
                  {item.id === "roadsync" ? (
                    <svg viewBox="0 0 120 48" className="cf-features-spotlight__mini-route">
                      <path d="M8 32 H112" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />
                      <path d="M8 34 H112" stroke="#FF5B00" strokeWidth="2" strokeLinecap="round" />
                      <path
                        d="M24 20 H96"
                        stroke="#279541"
                        strokeWidth="3"
                        strokeDasharray="5 4"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 120 48" className="cf-features-spotlight__mini-route">
                      <rect x="12" y="10" width="96" height="8" rx="2" fill="#E2E8F0" />
                      <rect x="12" y="26" width="72" height="8" rx="2" fill="#FF5B00" fillOpacity="0.35" />
                      <rect x="12" y="26" width="40" height="8" rx="2" fill="#FF5B00" fillOpacity="0.85" />
                    </svg>
                  )}
                </div>
                <div className="cf-features-spotlight__copy">
                  <p className="cf-features-spotlight__module" lang={item.moduleName.match(/^[A-Za-z]/) ? "en" : undefined}>
                    {item.moduleName}
                  </p>
                  <h3 className="cf-features-spotlight__headline">
                    {item.title}
                    <span className="cf-features-spotlight__status">{statusLabel}</span>
                  </h3>
                  <p className="cf-features-spotlight__body">{item.body}</p>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="cf-features-roadmap" aria-labelledby="features-planned-heading">
          <h3 id="features-planned-heading" className="cf-features-roadmap__title">
            {features.plannedPanelTitle}
          </h3>
          <ul className="cf-features-roadmap__list">
            {roadmap.map((item) => {
              const Icon = PLANNED_ICONS[item.id] ?? Layers;
              return (
                <li key={item.id} className="cf-features-roadmap__item">
                  <span className="cf-features-roadmap__icon" aria-hidden>
                    <Icon strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="cf-features-roadmap__module" lang={item.moduleName.match(/^[A-Za-z]/) ? "en" : undefined}>
                      {item.moduleName}
                      <span className="cf-features-roadmap__pill">{features.statusPlanned}</span>
                    </p>
                    <p className="cf-features-roadmap__body">{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        <p className="cf-features-section__disclosure">{features.disclosure}</p>
      </div>
    </section>
  );
}
