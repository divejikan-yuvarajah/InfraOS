import { Badge } from "@/components/ui/badge";
import { PublicRouteLine } from "@/components/landing/public-route-line";
import type { PublicLandingCopy } from "@/lib/landing/messages";

/** Bespoke annotated sequence for repeated excavation conflict (Section 9.1). */
export function CoordinationSequenceDiagram({
  illustration,
  solution,
}: {
  illustration: PublicLandingCopy["illustration"];
  solution: PublicLandingCopy["solution"];
}) {
  const steps = solution.flowSteps;

  return (
    <figure className="rounded-xl border border-border bg-surface p-4 shadow-elevation-sm">
      <svg
        viewBox="0 0 640 220"
        className="h-auto w-full"
        role="img"
        aria-labelledby="coord-sequence-title coord-sequence-desc"
      >
        <title id="coord-sequence-title">{illustration.title}</title>
        <desc id="coord-sequence-desc">{illustration.description}</desc>
        <rect x="16" y="96" width="608" height="28" rx="6" fill="var(--border)" opacity="0.5" />
        <path
          d="M 32 110 L 608 110"
          stroke="var(--infra-orange)"
          strokeWidth="2.5"
          fill="none"
        />
        {[120, 320, 520].map((cx, i) => (
          <g key={steps[i]?.id ?? i}>
            <circle
              cx={cx}
              cy={110}
              r={14}
              fill="var(--surface)"
              stroke={
                i === 1 ? "var(--infra-maroon)" : i === 2 ? "var(--infra-yellow)" : "var(--infra-green)"
              }
              strokeWidth="2"
            />
            <text x={cx} y={78} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="600">
              {steps[i]?.title ?? ""}
            </text>
            <text x={cx} y="158" textAnchor="middle" fill="var(--text-secondary)" fontSize="10">
              {i === 0 ? illustration.resurfacing : i === 1 ? illustration.pipeline : illustration.overlap}
            </text>
          </g>
        ))}
        <path
          d="M 134 110 L 306 110"
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="4 3"
          fill="none"
        />
        <path
          d="M 334 110 L 506 110"
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="4 3"
          fill="none"
        />
      </svg>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PublicRouteLine orientation="horizontal" className="hidden max-w-16 sm:block" />
        <ol className="grid flex-1 gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.id} className="rounded-lg border border-border bg-background p-3">
              <p className="type-caption text-text-muted">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="type-label mt-1 text-text-primary">{step.title}</p>
              <p className="type-body-small mt-1 text-text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="warning">{illustration.pending}</Badge>
        <Badge variant="critical">{illustration.critical}</Badge>
        <Badge variant="success">{illustration.resolved}</Badge>
      </div>
      <figcaption className="type-caption mt-3 text-text-muted">{solution.caption}</figcaption>
    </figure>
  );
}
