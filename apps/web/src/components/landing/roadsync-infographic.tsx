import type { CSSProperties } from "react";

import type { PublicLandingCopy } from "@/lib/landing/messages";

type Props = { copy: PublicLandingCopy };

/** RoadSync diagram — HTML labels + geometry SVG (synthetic fixture). */
export function RoadsyncInfographic({ copy }: Props) {
  const rs = copy.roadsyncSignature;
  const steps = rs.callouts;

  return (
    <figure
      className="cf-roadsync-infographic"
      aria-labelledby="roadsync-diagram-title roadsync-diagram-desc"
    >
      <div className="cf-roadsync-infographic__steps" aria-hidden>
        {steps.map((step, index) => (
          <div key={step.id} className="cf-roadsync-infographic__step">
            <span className="cf-roadsync-infographic__step-num">{index + 1}</span>
            <span className="cf-roadsync-infographic__step-title">{step.title}</span>
          </div>
        ))}
      </div>

      <div className="cf-roadsync-infographic__canvas">
        <div
          className="cf-roadsync-diagram cf-roadsync-diagram--desktop"
          role="group"
          aria-labelledby="roadsync-diagram-title roadsync-diagram-desc"
        >
          <p id="roadsync-diagram-title" className="cf-roadsync-diagram__map-label">
            {rs.mapLabel}
          </p>
          <p id="roadsync-diagram-desc" className="sr-only">
            {rs.diagramDescription}
          </p>

          <div className="cf-roadsync-diagram__corridor-wrap" aria-hidden>
            <svg
              viewBox="0 0 720 96"
              className="cf-roadsync-diagram__corridor-svg"
              preserveAspectRatio="xMidYMid meet"
            >
              <rect x="0" y="0" width="720" height="96" rx="6" fill="#F1F5F9" stroke="#E2E8F0" />
              <rect x="16" y="58" width="688" height="14" rx="7" fill="#94A3B8" />
              <rect x="16" y="63" width="688" height="4" rx="2" fill="#FF5B00" opacity="0.9" />
              <path
                d="M80 42 L640 68"
                stroke="#279541"
                strokeWidth="4"
                strokeDasharray="8 6"
                fill="none"
                strokeLinecap="round"
              />
              <rect
                x="278"
                y="28"
                width="164"
                height="40"
                rx="4"
                fill="#8C1F28"
                fillOpacity="0.12"
                stroke="#8C1F28"
                strokeWidth="1.5"
              />
            </svg>
            <p className="cf-roadsync-diagram__overlap-geo">{rs.overlapGeoLabel}</p>
          </div>

          <div className="cf-roadsync-diagram__timeline">
            <div className="cf-roadsync-diagram__timeline-axis">
              <span>{rs.timelineStart}</span>
              <span>{rs.timelineEnd}</span>
            </div>

            <div className="cf-roadsync-diagram__track">
              <p className="cf-roadsync-diagram__track-label">{rs.roadWorkLabel}</p>
              <div className="cf-roadsync-diagram__bar-rail">
                <span
                  className="cf-roadsync-diagram__bar cf-roadsync-diagram__bar--road"
                  style={{ "--bar-start": "21%", "--bar-size": "38%" } as CSSProperties}
                >
                  {rs.roadDates}
                </span>
              </div>
            </div>

            <div className="cf-roadsync-diagram__track">
              <p className="cf-roadsync-diagram__track-label">{rs.pipelineWorkLabel}</p>
              <div className="cf-roadsync-diagram__bar-rail">
                <span
                  className="cf-roadsync-diagram__bar cf-roadsync-diagram__bar--pipe"
                  style={{ "--bar-start": "29%", "--bar-size": "43%" } as CSSProperties}
                >
                  {rs.pipelineDates}
                </span>
              </div>
            </div>

            <div className="cf-roadsync-diagram__overlap-row">
              <p className="cf-roadsync-diagram__overlap-label">{rs.overlapScheduleLabel}</p>
              <p className="cf-roadsync-diagram__overlap-caption">{rs.overlapCaption}</p>
            </div>
          </div>

          <div className="cf-roadsync-diagram__review">
            <p className="cf-roadsync-diagram__review-label">{rs.reviewLabel}</p>
            <p className="cf-roadsync-diagram__review-body">{rs.reviewBody}</p>
          </div>
        </div>

        <div className="cf-roadsync-infographic__mobile-stack">
          <p className="cf-roadsync-infographic__mobile-lead">{rs.mobileMapSummary}</p>
          <dl className="cf-roadsync-infographic__mobile-dl">
            <div>
              <dt>{rs.roadWorkLabel}</dt>
              <dd>{rs.roadDates}</dd>
            </div>
            <div>
              <dt>{rs.pipelineWorkLabel}</dt>
              <dd>{rs.pipelineDates}</dd>
            </div>
            <div>
              <dt>{rs.overlapScheduleLabel}</dt>
              <dd>{rs.overlapCaption}</dd>
            </div>
          </dl>
          <p className="cf-roadsync-infographic__mobile-review">
            <strong>{rs.reviewLabel}:</strong> {rs.reviewBody}
          </p>
        </div>
      </div>

      <figcaption className="cf-roadsync-infographic__legend">
        <span>
          <i className="cf-roadsync-infographic__swatch cf-roadsync-infographic__swatch--road" />
          {rs.legendRoad}
        </span>
        <span>
          <i className="cf-roadsync-infographic__swatch cf-roadsync-infographic__swatch--pipe" />
          {rs.legendPipeline}
        </span>
        <span>
          <i className="cf-roadsync-infographic__swatch cf-roadsync-infographic__swatch--overlap" />
          {rs.legendOverlap}
        </span>
      </figcaption>
      <p className="cf-roadsync-infographic__disclaimer">{rs.disclaimer}</p>
    </figure>
  );
}
