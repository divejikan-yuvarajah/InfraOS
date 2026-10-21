import { CalendarRange, Construction, Droplets, MapPin, Users } from "lucide-react";

import type { PublicLandingCopy } from "@/lib/landing/messages";

const STORY_ICONS = {
  place: MapPin,
  time: CalendarRange,
  people: Users,
} as const;

/** Signature RoadSync visualization — synthetic corridor + schedule overlap. */
export function RoadsyncCoordinationShowcase({ copy }: { copy: PublicLandingCopy }) {
  const rs = copy.roadsyncSignature;

  return (
    <figure
      className="cf-roadsync-showcase"
      aria-labelledby="roadsync-diagram-title roadsync-diagram-desc"
    >
      <ol className="cf-roadsync-showcase__story">
        {rs.callouts.map((step) => {
          const Icon = STORY_ICONS[step.id as keyof typeof STORY_ICONS] ?? MapPin;
          return (
            <li key={step.id} className="cf-roadsync-showcase__story-step">
              <span className="cf-roadsync-showcase__story-icon" aria-hidden>
                <Icon className="size-4" />
              </span>
              <div>
                <p className="cf-roadsync-showcase__story-title">{step.title}</p>
                <p className="cf-roadsync-showcase__story-body">{step.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="cf-roadsync-showcase__diagram">
        <p className="cf-roadsync-showcase__map-label">{rs.mapLabel}</p>
        <div className="cf-roadsync-showcase__corridor" aria-hidden>
          <span className="cf-roadsync-showcase__road-surface" />
          <span className="cf-roadsync-showcase__pipeline" />
          <span className="cf-roadsync-showcase__overlap-zone">
            <Construction className="size-3.5 text-[#FF5B00]" />
            <Droplets className="size-3.5 text-[#279541]" />
          </span>
        </div>

        <div className="cf-roadsync-showcase__schedules">
          <div className="cf-roadsync-showcase__track">
            <span className="cf-roadsync-showcase__track-label">
              <Construction className="size-4 shrink-0 text-[#FF5B00]" aria-hidden />
              {rs.roadWorkLabel}
            </span>
            <div className="cf-roadsync-showcase__bar-wrap">
              <div className="cf-roadsync-showcase__bar cf-roadsync-showcase__bar--road">
                {rs.roadDates}
              </div>
            </div>
          </div>
          <div className="cf-roadsync-showcase__track">
            <span className="cf-roadsync-showcase__track-label">
              <Droplets className="size-4 shrink-0 text-[#279541]" aria-hidden />
              {rs.pipelineWorkLabel}
            </span>
            <div className="cf-roadsync-showcase__bar-wrap">
              <div className="cf-roadsync-showcase__bar cf-roadsync-showcase__bar--pipe">
                {rs.pipelineDates}
              </div>
            </div>
          </div>
        </div>

        <p className="cf-roadsync-showcase__overlap">
          <CalendarRange className="size-4 shrink-0 text-[#8C1F28]" aria-hidden />
          <span>
            <strong>{rs.overlapScheduleLabel}</strong>
            <span className="cf-roadsync-showcase__overlap-caption"> — {rs.overlapCaption}</span>
          </span>
        </p>

        <p className="cf-roadsync-showcase__review">
          <Users className="size-4 shrink-0 text-[#475569]" aria-hidden />
          <span>
            <strong>{rs.reviewLabel}:</strong> {rs.reviewBody}
          </span>
        </p>
      </div>

      <svg
        viewBox="0 0 720 420"
        className="sr-only"
        role="img"
        aria-labelledby="roadsync-diagram-title roadsync-diagram-desc"
      >
        <title id="roadsync-diagram-title">{rs.diagramTitle}</title>
        <desc id="roadsync-diagram-desc">{rs.diagramDescription}</desc>
      </svg>

      <figcaption className="cf-roadsync-showcase__legend">
        <span>
          <span className="cf-roadsync-showcase__swatch cf-roadsync-showcase__swatch--road" />
          {rs.legendRoad}
        </span>
        <span>
          <span className="cf-roadsync-showcase__swatch cf-roadsync-showcase__swatch--pipe" />
          {rs.legendPipeline}
        </span>
        <span>
          <span className="cf-roadsync-showcase__swatch cf-roadsync-showcase__swatch--overlap" />
          {rs.legendOverlap}
        </span>
      </figcaption>
      <p className="cf-roadsync-showcase__disclaimer">{rs.disclaimer}</p>
    </figure>
  );
}
