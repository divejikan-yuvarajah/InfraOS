import type { PublicLandingCopy } from "@/lib/landing/messages";
import { PREVIEW_CORRIDOR, PREVIEW_SCHEDULES, sharedDateWindow } from "@/lib/landing/preview-data";

export function CoordinationPreviewFigure({ copy }: { copy: PublicLandingCopy }) {
  const preview = copy.preview;
  const overlap = sharedDateWindow(PREVIEW_SCHEDULES.road, PREVIEW_SCHEDULES.water);

  return (
    <figure className="min-w-0 space-y-3">
      <svg
        role="img"
        aria-labelledby="preview-figure-title preview-figure-desc"
        viewBox="0 0 640 220"
        className="h-auto w-full rounded-lg border border-border bg-surface"
      >
        <title id="preview-figure-title">{preview.figureTitle}</title>
        <desc id="preview-figure-desc">{preview.figureDescription}</desc>
        <rect x="24" y="36" width="592" height="120" rx="8" fill="#F8FAFC" stroke="#E2E8F0" />
        <line
          x1={PREVIEW_CORRIDOR.road.x1}
          y1={PREVIEW_CORRIDOR.y}
          x2={PREVIEW_CORRIDOR.road.x2}
          y2={PREVIEW_CORRIDOR.y}
          stroke="#FF5B00"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <line
          x1={PREVIEW_CORRIDOR.water.x1}
          y1={PREVIEW_CORRIDOR.y}
          x2={PREVIEW_CORRIDOR.water.x2}
          y2={PREVIEW_CORRIDOR.y}
          stroke="#475569"
          strokeWidth="4"
          strokeDasharray="10 7"
          strokeLinecap="round"
        />
        <rect
          x={PREVIEW_CORRIDOR.water.x1 - 12}
          y="64"
          width={PREVIEW_CORRIDOR.water.x2 - PREVIEW_CORRIDOR.water.x1 + 24}
          height="72"
          fill="none"
          stroke="#8C1F28"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <text x={PREVIEW_CORRIDOR.water.x1} y="56" fill="#111827" fontSize="14">
          {preview.overlapMark}
        </text>
      </svg>
      <figcaption className="space-y-2">
        <p className="type-body-small text-text-primary">{preview.figureCaption}</p>
        <p className="type-caption text-text-muted">{preview.notToScale}</p>
        <ul className="type-caption grid gap-1 text-text-secondary sm:grid-cols-3">
          <li>
            <span aria-hidden="true" className="me-2 inline-block h-1 w-6 align-middle bg-[#FF5B00]" />
            {preview.legendRoad}
          </li>
          <li>
            <span
              aria-hidden="true"
              className="me-2 inline-block h-0 w-6 border-t-2 border-dashed border-[#475569] align-middle"
            />
            {preview.legendWater}
          </li>
          <li>
            <span
              aria-hidden="true"
              className="me-2 inline-block h-3 w-6 border border-dashed border-[#8C1F28] align-middle"
            />
            {preview.legendOverlap}
          </li>
        </ul>
        {overlap ? (
          <p className="type-caption text-text-muted">
            {preview.scheduleRoad}: {PREVIEW_SCHEDULES.road.startDate} – {PREVIEW_SCHEDULES.road.endDate}
            . {preview.scheduleWater}: {PREVIEW_SCHEDULES.water.startDate} –{" "}
            {PREVIEW_SCHEDULES.water.endDate}. {preview.overlapDates}: {overlap.startDate} –{" "}
            {overlap.endDate}.
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}
