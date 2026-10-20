import type { PublicLandingCopy } from "@/lib/landing/messages";

type Props = {
  copy: PublicLandingCopy;
};

/** Signature RoadSync corridor + schedule overlap (synthetic, accessible). */
export function RoadsyncCorridorExplainer({ copy }: Props) {
  const rs = copy.roadsyncSignature;

  return (
    <figure className="public-roadsync-diagram">
      <div className="public-roadsync-diagram__desktop-svg">
        <svg
          viewBox="0 0 720 420"
          className="public-roadsync-diagram__svg"
          role="img"
          aria-labelledby="roadsync-diagram-title roadsync-diagram-desc"
        >
          <title id="roadsync-diagram-title">{rs.diagramTitle}</title>
          <desc id="roadsync-diagram-desc">{rs.diagramDescription}</desc>

          {/* Map strip */}
          <rect x="24" y="24" width="672" height="100" rx="8" fill="#F1F5F9" stroke="#E2E8F0" />
          <text x="36" y="48" fill="#475569" fontSize="11" fontWeight="600">
            {rs.mapLabel}
          </text>
          <path d="M48 88 L672 88" stroke="#64748B" strokeWidth="8" strokeLinecap="round" />
          <path d="M48 88 L672 88" stroke="#FF5B00" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M120 70 L580 106"
            stroke="#279541"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
          <rect
            x="300"
            y="74"
            width="120"
            height="28"
            rx="4"
            fill="#8C1F28"
            fillOpacity="0.18"
            stroke="#8C1F28"
            strokeWidth="1.5"
          />
          <text x="360" y="92" textAnchor="middle" fill="#8C1F28" fontSize="10" fontWeight="600">
            {rs.overlapGeoLabel}
          </text>

          {/* Timeline axis */}
          <line x1="48" y1="160" x2="672" y2="160" stroke="#CBD5E1" strokeWidth="1" />
          <text x="48" y="150" fill="#64748B" fontSize="10">
            {rs.timelineStart}
          </text>
          <text x="672" y="150" textAnchor="end" fill="#64748B" fontSize="10">
            {rs.timelineEnd}
          </text>

          {/* Road resurfacing bar */}
          <text x="48" y="188" fill="#111827" fontSize="12" fontWeight="600">
            {rs.roadWorkLabel}
          </text>
          <rect x="140" y="172" width="280" height="22" rx="4" fill="#FF5B00" fillOpacity="0.85" />
          <text x="280" y="187" textAnchor="middle" fill="#111827" fontSize="10" fontWeight="600">
            {rs.roadDates}
          </text>

          {/* Pipeline bar */}
          <text x="48" y="238" fill="#111827" fontSize="12" fontWeight="600">
            {rs.pipelineWorkLabel}
          </text>
          <rect x="220" y="222" width="320" height="22" rx="4" fill="#279541" fillOpacity="0.75" />
          <text x="380" y="237" textAnchor="middle" fill="#111827" fontSize="10" fontWeight="600">
            {rs.pipelineDates}
          </text>

          {/* Overlap highlight on timeline */}
          <rect x="220" y="268" width="200" height="28" rx="4" fill="#8C1F28" fillOpacity="0.15" stroke="#8C1F28" />
          <text x="320" y="286" textAnchor="middle" fill="#8C1F28" fontSize="11" fontWeight="700">
            {rs.overlapScheduleLabel}
          </text>
          <text x="48" y="286" fill="#475569" fontSize="11">
            {rs.overlapCaption}
          </text>

          {/* Coordination note */}
          <rect x="24" y="320" width="672" height="76" rx="8" fill="#111827" fillOpacity="0.04" stroke="#E2E8F0" />
          <text x="40" y="348" fill="#111827" fontSize="12" fontWeight="600">
            {rs.reviewLabel}
          </text>
          <text x="40" y="372" fill="#475569" fontSize="11">
            {rs.reviewBody}
          </text>
        </svg>
      </div>

      <div className="public-roadsync-diagram__mobile-stack" aria-hidden="false">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="type-label text-text-primary">{rs.mapLabel}</p>
          <p className="type-body-small mt-2 text-text-secondary">{rs.mobileMapSummary}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="type-label text-text-primary">{rs.roadWorkLabel}</p>
          <p className="type-body-small mt-1 text-text-secondary">{rs.roadDates}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="type-label text-text-primary">{rs.pipelineWorkLabel}</p>
          <p className="type-body-small mt-1 text-text-secondary">{rs.pipelineDates}</p>
        </div>
        <div className="rounded-lg border border-[#8C1F28]/40 bg-[#8C1F28]/5 p-3">
          <p className="type-label text-[#8C1F28]">{rs.overlapScheduleLabel}</p>
          <p className="type-body-small mt-1 text-text-secondary">{rs.overlapCaption}</p>
        </div>
      </div>

      <figcaption className="public-roadsync-diagram__legend">
        <div>
          <span className="mr-2 inline-block size-3 rounded-sm bg-[#FF5B00]" aria-hidden />
          <span className="type-caption text-text-secondary">{rs.legendRoad}</span>
        </div>
        <div>
          <span
            className="mr-2 inline-block size-3 rounded-sm border border-dashed border-[#279541] bg-[#279541]/30"
            aria-hidden
          />
          <span className="type-caption text-text-secondary">{rs.legendPipeline}</span>
        </div>
        <div>
          <span className="mr-2 inline-block size-3 rounded-sm bg-[#8C1F28]/40" aria-hidden />
          <span className="type-caption text-text-secondary">{rs.legendOverlap}</span>
        </div>
      </figcaption>
      <p className="type-caption border-t border-border px-4 py-3 text-text-muted">{rs.disclaimer}</p>
    </figure>
  );
}
