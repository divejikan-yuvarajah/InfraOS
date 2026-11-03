import { InfoIcon, ShieldCheckIcon } from "lucide-react";

import type { LpCopy } from "@/lib/landing/lp-copy";
import { LP_ANCHORS } from "@/lib/landing/lp-data";

/** Academic and pilot disclosure + National Platform Deployment Cadence panel. */
export function TransparencyPanel({ copy }: { copy: LpCopy["transparency"] }) {
  return (
    <section id={LP_ANCHORS.transparency} className="lp-section lp-section--card" aria-labelledby="lp-transparency-title">
      <div className="lp-container">
        <div id="status-panel" className="lp-cadence">
          <div className="lp-cadence__head">
            <div className="lp-cadence__icon" aria-hidden="true">
              <ShieldCheckIcon width={24} height={24} />
            </div>
            <div>
              <span className="lp-eyebrow">{copy.cadenceEyebrow}</span>
              <h2 className="lp-display lp-h2 lp-h2--md">{copy.cadenceTitle}</h2>
              <p className="lp-cadence__lede">{copy.cadenceLede}</p>
            </div>
          </div>
          <ul className="lp-cadence__grid" style={{ listStyle: "none", padding: 0, margin: "1.5rem 0 0" }}>
            {copy.cadenceItems.map((item) => (
              <li key={item.title} className="lp-cadence__card">
                <div>
                  <div className="lp-cadence__top">
                    <div className={`lp-cadence__status lp-cadence__status--${item.tone}`}>
                      <span className="lp-dot" aria-hidden="true" />
                      {item.status}
                    </div>
                    <span className="lp-cadence__phase">{item.phase}</span>
                  </div>
                  <h3 className="lp-cadence__title">{item.title}</h3>
                  <p className="lp-cadence__text">{item.text}</p>
                </div>
                <div className="lp-cadence__barwrap">
                  <div className="lp-cadence__meta">
                    <span>{item.metricLabel}</span>
                    <strong>{item.metricValue}</strong>
                  </div>
                  <div className="lp-cadence__bar">
                    <div
                      className={`lp-cadence__fill lp-cadence__fill--${item.tone}`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="lp-disclosure" style={{ marginTop: "1.5rem" }}>
          <span className="lp-eyebrow">{copy.eyebrow}</span>
          <h2 id="lp-transparency-title" className="lp-display lp-h2 lp-h2--md">
            {copy.title}
          </h2>
          <p className="lp-disclosure__lede">{copy.lede}</p>
          <ul className="lp-disclosure__grid" style={{ listStyle: "none", padding: 0, margin: "2rem 0 0" }}>
            {copy.items.map((item) => (
              <li key={item.label} className="lp-disclosure__item">
                <div className="lp-disclosure__label">{item.label}</div>
                <h3 className="lp-display">{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
          <p className="lp-disclosure__note">
            <InfoIcon aria-hidden="true" />
            {copy.note}
          </p>
        </div>
      </div>
    </section>
  );
}

