import type { PublicLandingCopy } from "@/lib/landing/messages";
import { PREVIEW_CORRIDOR, PREVIEW_SCHEDULES, sharedDateWindow } from "@/lib/landing/preview-data";

export function CoordinationPreviewFigure({ copy }: { copy: PublicLandingCopy }) {
  const preview = copy.preview;
  const overlap = sharedDateWindow(PREVIEW_SCHEDULES.road, PREVIEW_SCHEDULES.water);

  return (
    <figure
      className="cf-gis-canvas min-w-0"
      aria-labelledby="cf-gis-figure-title"
      role="group"
    >
      <p id="cf-gis-figure-title" className="sr-only">
        {preview.figureTitle}
      </p>
      <div className="cf-gis-canvas__grid">
        <div className="cf-gis-map">
          <svg
            className="cf-gis-map__svg"
            viewBox="0 0 640 220"
            aria-hidden
            focusable="false"
          >
            <rect x="0" y="0" width="640" height="220" fill="transparent" />
            <rect x="24" y="28" width="592" height="164" rx="10" fill="#0f172a" stroke="#334155" />
            <path
              d="M48 140 Q 200 120, 320 130 T 592 125"
              fill="none"
              stroke="#1e293b"
              strokeWidth="24"
              strokeLinecap="round"
            />
            <line
              x1={PREVIEW_CORRIDOR.road.x1}
              y1={PREVIEW_CORRIDOR.y}
              x2={PREVIEW_CORRIDOR.road.x2}
              y2={PREVIEW_CORRIDOR.y}
              stroke="#FF5B00"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <line
              x1={PREVIEW_CORRIDOR.water.x1}
              y1={PREVIEW_CORRIDOR.y - 18}
              x2={PREVIEW_CORRIDOR.water.x2}
              y2={PREVIEW_CORRIDOR.y - 18}
              stroke="#94A3B8"
              strokeWidth="5"
              strokeDasharray="10 7"
              strokeLinecap="round"
            />
            <rect
              x={PREVIEW_CORRIDOR.water.x1 - 10}
              y="58"
              width={PREVIEW_CORRIDOR.water.x2 - PREVIEW_CORRIDOR.water.x1 + 20}
              height="88"
              fill="rgb(254 182 0 / 0.12)"
              stroke="#8C1F28"
              strokeWidth="2"
              strokeDasharray="5 4"
              rx="4"
            />
            <circle cx={PREVIEW_CORRIDOR.water.x1} cy={PREVIEW_CORRIDOR.y} r="6" fill="#279541" />
            <circle cx={PREVIEW_CORRIDOR.water.x2} cy={PREVIEW_CORRIDOR.y} r="6" fill="#279541" />
          </svg>
          <div className="cf-gis-map__labels" aria-hidden>
            <span className="cf-gis-map__chip cf-gis-map__chip--road">{preview.agencyRoadLabel}</span>
            <span className="cf-gis-map__chip cf-gis-map__chip--water">{preview.agencyWaterLabel}</span>
            <span className="cf-gis-map__chip cf-gis-map__chip--shared">{preview.sharedSegmentLabel}</span>
          </div>
        </div>

        <div className="cf-gis-timeline" aria-hidden={false}>
          <div className="cf-gis-timeline__row">
            <span className="cf-gis-timeline__label">{preview.scheduleRoad}</span>
            <div className="cf-gis-timeline__bar">
              <span className="cf-gis-timeline__fill cf-gis-timeline__fill--road" />
            </div>
            <span className="cf-gis-footnote">
              {PREVIEW_SCHEDULES.road.startDate} – {PREVIEW_SCHEDULES.road.endDate}
            </span>
          </div>
          <div className="cf-gis-timeline__row">
            <span className="cf-gis-timeline__label">{preview.scheduleWater}</span>
            <div className="cf-gis-timeline__bar">
              <span className="cf-gis-timeline__fill cf-gis-timeline__fill--water" />
            </div>
            <span className="cf-gis-footnote">
              {PREVIEW_SCHEDULES.water.startDate} – {PREVIEW_SCHEDULES.water.endDate}
            </span>
          </div>
          {overlap ? (
            <div className="cf-gis-timeline__row">
              <span className="cf-gis-timeline__label">{preview.overlapDates}</span>
              <div className="cf-gis-timeline__bar">
                <span className="cf-gis-timeline__fill cf-gis-timeline__fill--overlap" />
              </div>
              <span className="cf-gis-footnote">
                {overlap.startDate} – {overlap.endDate}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <figcaption className="mt-3 space-y-2">
        <p className="sr-only">{preview.figureDescription}</p>
        <p className="cf-gis-footnote text-[#cbd5e1]">{preview.figureCaption}</p>
        <p className="cf-gis-footnote text-[#64748b]">{preview.notToScale}</p>
        <ul className="cf-gis-legend">
          <li className="cf-gis-legend__item">
            <span aria-hidden className="inline-block h-1 w-5 rounded bg-[#FF5B00]" />
            {preview.legendRoad}
          </li>
          <li className="cf-gis-legend__item">
            <span
              aria-hidden
              className="inline-block h-0 w-5 border-t-2 border-dashed border-[#94A3B8]"
            />
            {preview.legendWater}
          </li>
          <li className="cf-gis-legend__item">
            <span
              aria-hidden
              className="inline-block h-3 w-5 border border-dashed border-[#8C1F28]"
            />
            {preview.legendOverlap}
          </li>
        </ul>
      </figcaption>
    </figure>
  );
}
