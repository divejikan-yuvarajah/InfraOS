"use client";

import { CircleCheckIcon, SirenIcon, TriangleAlertIcon, WandSparklesIcon } from "lucide-react";
import { useState } from "react";

import type { LpCopy } from "@/lib/landing/lp-copy";
import { LP_ANCHORS, LP_INCIDENT_LANES } from "@/lib/landing/lp-data";

import { FigureCaption, SectionHeader } from "./atoms";

const RESEQUENCED_LANES = [
  { left: 50, width: 36 },
  { left: 4, width: 32 },
  { left: 14, width: 28 },
] as const;

/** Conceptual conflict timeline: semantic lanes, interactive re-sequence preview and a text alternative. */
export function IncidentSequenceSimulation({ copy }: { copy: LpCopy["incident"] }) {
  const [resequenced, setResequenced] = useState(false);

  return (
    <section id={LP_ANCHORS.incident} className="lp-section lp-section--card" aria-labelledby="lp-incident-title">
      <div className="lp-container">
        <SectionHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          id="lp-incident-title"
          medium
          aside={
            <div className="lp-flag" role="status">
              <span className="lp-dot" aria-hidden="true" />
              {copy.flag}
            </div>
          }
        />
        <div className="lp-incident">
          <FigureCaption
            src="/landing/lp/asphalt-paving.jpg"
            alt={copy.imageAlt}
            sizes="(min-width: 1280px) 1136px, 100vw"
            label={copy.plateLabel}
            caption={copy.plateCaption}
            chip={copy.plateChip}
            dot="var(--lp-success)"
          />
          <div className="lp-alert">
            <div className="lp-alert__main">
              <SirenIcon aria-hidden="true" />
              <div>
                <span className="lp-alert__title">{copy.alertTitle}</span>
                <p className="lp-alert__text">{copy.alertText}</p>
              </div>
            </div>
            <button
              type="button"
              className="lp-alert__tag lp-alert__btn lp-on-dark"
              aria-pressed={resequenced}
              onClick={() => setResequenced((prev) => !prev)}
            >
              <WandSparklesIcon aria-hidden="true" width={14} height={14} />
              {resequenced ? copy.alertTagApplied : copy.alertTag}
            </button>
          </div>
          <div className="lp-lanes" aria-hidden="true">
            {copy.lanes.map((lane, index) => {
              const geo = LP_INCIDENT_LANES[index];
              const activeGeo = resequenced ? RESEQUENCED_LANES[index] : geo;
              const isCollision = !resequenced && geo.collision;
              return (
                <div key={lane.agency} className="lp-lane">
                  <div className="lp-lane__label">
                    <span className={`lp-lane__swatch lp-lane__swatch--${geo.tone}`} />
                    <span className="lp-lane__agency">{lane.agency}</span>
                    <span className="lp-lane__type">{lane.type}</span>
                  </div>
                  <div className="lp-lane__track">
                    <div className="lp-lane__ticks">
                      {copy.dayTicks.map((tick) => (
                        <span key={tick}>{tick}</span>
                      ))}
                    </div>
                    <div
                      className={`lp-lane__bar ${isCollision ? "lp-lane__bar--hit" : resequenced ? "lp-lane__bar--synced" : "lp-lane__bar--ok"}`}
                      style={{
                        left: `${activeGeo.left}%`,
                        width: `${activeGeo.width}%`,
                        minWidth: isCollision ? "9.5rem" : undefined,
                      }}
                    >
                      <span>
                        {isCollision ? <TriangleAlertIcon /> : resequenced ? <CircleCheckIcon /> : null}
                        {resequenced ? lane.resequencedBar : lane.bar}
                      </span>
                      {isCollision ? (
                        <em>{copy.collision}</em>
                      ) : resequenced ? (
                        <em>{copy.cleared}</em>
                      ) : lane.sub ? (
                        <small>{lane.sub}</small>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <ol className="lp-sr-only" aria-label={copy.laneListLabel}>
            {copy.lanes.map((lane, index) => (
              <li key={lane.agency}>
                {lane.agency} {lane.type}: {resequenced ? lane.resequencedBar : lane.bar}
                {lane.sub ? `, ${lane.sub}` : ""}
                {!resequenced && LP_INCIDENT_LANES[index].collision ? ` — ${copy.collision}` : ""}
              </li>
            ))}
            <li>{copy.platformAction}</li>
          </ol>
          <div className="lp-incident__foot">
            <div className="lp-incident__action">
              <WandSparklesIcon aria-hidden="true" />
              <span>{copy.platformAction}</span>
            </div>
            <span className="lp-incident__ok">
              <CircleCheckIcon aria-hidden="true" />
              {copy.outcomeTag}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

